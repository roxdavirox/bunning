# Syscalls — Interface Direta com o Kernel

> Como Bun expoe syscalls diretas e as implicacoes de seguranca.

---

## Intuition (Feynman)

Syscalls sao como ligar diretamente para o governo (kernel) sem passar por intermediarios (libc, runtime). Normalmente voce usa abstracooes: `fs.readFile()` → libc `fread()` → syscall `read()`. Com `bun.syscall()`, voce pula todos os intermediarios.

E como ter um walkie-talkie direto com o presidente: poder absoluto, sem filtros, sem protecoes.

---

## Source Code

No repositorio `oven-sh/bun`:
```
src/
├── bun.js/
│   └── api/
│       └── syscall.zig    # Implementacao de bun.syscall
└── ...
```

---

## Hands-On Analysis

### 1. Syscall API do Bun

```typescript
import { syscall, ptr } from "bun";

// SYS_getpid = 39 (Linux x86_64)
const pid = syscall(39n);
console.log("PID:", pid.toString());

// SYS_getuid = 102
const uid = syscall(102n);
console.log("UID:", uid.toString());

// SYS_gettid = 186
const tid = syscall(186n);
console.log("TID:", tid.toString());
```

### 2. Tabela de Syscalls Importantes

```typescript
// Linux x86_64 syscall numbers
const SYS = {
    read:     0n,
    write:    1n,
    open:     2n,
    close:    3n,
    stat:     4n,
    fstat:    5n,
    lstat:    6n,
    poll:     7n,
    mmap:     9n,
    mprotect: 10n,
    munmap:   11n,
    brk:      12n,
    // ...
    execve:   59n,
    exit:     60n,
    wait4:    61n,
    kill:     62n,
    // ...
    getpid:   39n,
    getuid:   102n,
    socket:   41n,
    connect:  42n,
    accept:   43n,
    sendto:   44n,
    recvfrom: 45n,
};

// Verificar versao Linux
const buf = new Uint8Array(390); // sizeof utsname
syscall(63n, ptr(buf)); // SYS_uname
const sysname = new TextDecoder().decode(buf.slice(0, 65)).replace(/\0/g, "");
console.log("Sistema:", sysname);
```

### 3. Operacoes de Arquivo via Syscall

```typescript
import { syscall, ptr } from "bun";

// SYS_open: abrir arquivo
const pathBuf = new TextEncoder().encode("/etc/hostname\0");
const fd = syscall(2n, ptr(pathBuf), 0n, 0n); // O_RDONLY = 0

if (fd < 0n) {
    console.error("Erro ao abrir:", -fd);
} else {
    // SYS_read: ler
    const readBuf = new Uint8Array(256);
    const bytesRead = syscall(0n, fd, ptr(readBuf), 256n);

    console.log("Conteudo:", new TextDecoder().decode(readBuf.slice(0, Number(bytesRead))));

    // SYS_close: fechar
    syscall(3n, fd);
}
```

### 4. Informacoes do Processo

```typescript
import { syscall, ptr } from "bun";

// Ler /proc/self/status via syscalls diretas
const pathBuf = new TextEncoder().encode("/proc/self/status\0");
const fd = syscall(2n, ptr(pathBuf), 0n, 0n);

const buf = new Uint8Array(4096);
const n = syscall(0n, fd, ptr(buf), 4096n);
syscall(3n, fd);

const status = new TextDecoder().decode(buf.slice(0, Number(n)));
const lines = status.split("\n").filter(l => l.match(/^(Pid|Uid|Gid|VmRSS)/));
lines.forEach(l => console.log(l));
```

---

## Security Analysis

### Bypass de Abstracoes

```typescript
// FFI/syscalls bypassam COMPLETAMENTE qualquer restricao JS

// Exemplo: ler arquivo sem usar APIs do Bun
// (contorna qualquer hook/monitoramento que intercepte Bun.file())
function rawReadFile(path: string): string {
    const pathBuf = new TextEncoder().encode(path + "\0");
    const fd = syscall(2n, ptr(pathBuf), 0n, 0n);
    if (fd < 0n) throw new Error(`open failed: ${-fd}`);

    const buf = new Uint8Array(65536);
    const n = syscall(0n, fd, ptr(buf), BigInt(buf.length));
    syscall(3n, fd);

    return new TextDecoder().decode(buf.slice(0, Number(n)));
}

// Este codigo e equivalente ao Bun.file().text() mas sem hooks
```

### Seccomp e Filtragem de Syscalls

```bash
# Seccomp: filtrar quais syscalls o processo pode fazer
# Nao configurado por padrao no Bun

# Verificar se processo tem seccomp ativo
cat /proc/$$/status | grep Seccomp
# 0 = sem seccomp, 1 = strict, 2 = filter

# Container pode ter seccomp profile
# Docker default bloqueia ~40 syscalls "perigosas"
docker run --rm alpine cat /proc/1/status | grep Seccomp

# Verificar perfil seccomp do Docker
docker info --format '{{.SecurityOptions}}'
```

### Syscalls Perigosas

```typescript
// Estas syscalls sao especialmente perigosas via bun.syscall:

// SYS_execve (59): executar novo processo
// SYS_fork (57): criar processo filho
// SYS_ptrace (101): depurar/controlar outro processo
// SYS_mount (165): montar sistema de arquivos
// SYS_init_module (175): carregar modulo kernel
// SYS_kexec_load (246): carregar novo kernel

// Em um container, algumas dessas sao bloqueadas pelo seccomp
// profile do Docker — verificar com:
// docker run --security-opt seccomp=unconfined ...
```

---

## Exercises

### Ex F4.1 — Syscall Direct I/O

```typescript
// Implemente cat usando apenas syscalls diretas
import { syscall, ptr } from "bun";

async function catFile(filepath: string) {
    const pathBuf = new TextEncoder().encode(filepath + "\0");
    const fd = syscall(2n, ptr(pathBuf), 0n, 0n); // open

    if (fd < 0n) {
        const err = Number(-fd);
        process.stderr.write(`cat: ${filepath}: errno ${err}\n`);
        return;
    }

    const chunk = new Uint8Array(4096);
    let bytesRead: bigint;

    do {
        bytesRead = syscall(0n, fd, ptr(chunk), 4096n); // read
        if (bytesRead > 0n) {
            // SYS_write: stdout (fd=1)
            syscall(1n, 1n, ptr(chunk), bytesRead);
        }
    } while (bytesRead === 4096n);

    syscall(3n, fd); // close
}

await catFile("/etc/hostname");
```

### Ex F4.2 — Seccomp Check

```bash
# Verificar quais syscalls estao disponiveis no container atual
cat > /tmp/syscall_probe.ts << 'EOF'
import { syscall, ptr } from "bun";

// Testar syscalls sensiveis
const tests = [
    [39n, "getpid", []],
    [59n, "execve", [ptr(new TextEncoder().encode("/bin/ls\0")), 0n, 0n]],
    [101n, "ptrace", [0n, 0n, 0n, 0n]],
];

for (const [num, name, args] of tests) {
    try {
        const ret = syscall(num as bigint, ...(args as bigint[]));
        console.log(`${name} (${num}): retornou ${ret}`);
    } catch (e) {
        console.log(`${name} (${num}): ERRO - ${e.message}`);
    }
}
EOF
bun /tmp/syscall_probe.ts 2>&1
```

### Ex F4.3 — Process Info via /proc

```typescript
// Ler informacoes do processo via syscalls e /proc
import { syscall, ptr } from "bun";

function readFile(path: string): string {
    const pathBuf = new TextEncoder().encode(path + "\0");
    const fd = syscall(2n, ptr(pathBuf), 0n, 0n);
    if (fd < 0n) return "";

    const buf = new Uint8Array(65536);
    const n = syscall(0n, fd, ptr(buf), BigInt(buf.length));
    syscall(3n, fd);
    return new TextDecoder().decode(buf.slice(0, Number(n)));
}

const pid = syscall(39n);
console.log(`PID: ${pid}`);
console.log("\n/proc/self/cmdline:", readFile("/proc/self/cmdline").replace(/\0/g, " "));
console.log("\n/proc/self/environ (parcial):", readFile("/proc/self/environ").split("\0").slice(0, 3).join("\n"));
```

---

## Checkpoint

[ ] Executou syscalls diretas (getpid, getuid)
[ ] Implementou leitura de arquivo via SYS_open/read/close
[ ] Entende que syscalls bypassam todas as abstracoes
[ ] Verificou seccomp no container
[ ] Testou syscalls "perigosas" e observou comportamento

---

## Next

→ [`../http/01-server`](../../http/01-server/) — servidor HTTP nativo do Bun
