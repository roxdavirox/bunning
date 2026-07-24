# Sandbox — Modelo de Seguranca do Bun

> Como o Bun (nao) implementa sandbox e comparacao com Deno.

---

## Intuition (Feynman)

Sandbox e como um terrario: o animal (codigo) vive dentro de um espaco controlado, nao pode sair para o mundo real sem permissao. Deno tem sandbox — voce precisa de `--allow-read`, `--allow-net`, `--allow-env` para cada acesso.

Bun nao tem sandbox. E como um terrario sem tampa: o codigo pode sair (acessar arquivos, rede, env vars) sem pedir permissao. Isso e uma escolha de design (compatibilidade com Node.js) mas tem implicacoes de seguranca significativas.

---

## Source Code

No repositorio `oven-sh/bun`:
```
# Bun nao tem sandbox
# A unica "sandbox" e a do sistema operacional (usuarios, DAC, MAC)

# Para sandbox real, use:
# - containers Docker
# - seccomp
# - bubblewrap/firejail
# - namespaces Linux
```

---

## Hands-On Analysis

### 1. Ausencia de Sandbox no Bun

```typescript
// Bun: tudo permitido sem configuracao
// Acesso a filesystem
const content = await Bun.file("/etc/hosts").text();
console.log(content.substring(0, 100));

// Acesso a rede
const res = await fetch("https://example.com");
console.log(res.status);

// Variaveis de ambiente
console.log(Bun.env.HOME);
console.log(Bun.env.PATH);

// Spawn processos
const proc = Bun.spawn(["ls", "/etc"]);
const output = await new Response(proc.stdout).text();
console.log(output.substring(0, 100));
```

### 2. Comparacao com Deno

```bash
# Deno: precisa de permissao explicita
deno eval "
import { readTextFile } from 'node:fs/promises';
const content = await readTextFile('/etc/hosts');
console.log(content.substring(0, 50));
" 2>&1
# Error: Requires read access to "/etc/hosts"
# Hint: run again with --allow-read

# Com permissao:
deno eval --allow-read=/etc/hosts "
import { readTextFile } from 'node:fs/promises';
const content = await readTextFile('/etc/hosts');
console.log(content.substring(0, 50));
"

# Bun: sem flags necessarias
bun eval "console.log(await Bun.file('/etc/hosts').text())"
```

### 3. Sandbox via OS

```bash
# Como implementar sandbox para Bun via OS

# 1. Seccomp: filtrar syscalls
cat > /tmp/seccomp_bun.sh << 'EOF'
#!/bin/bash
# Instalar firejail: apt install firejail

# Sandbox com restricoes de rede e filesystem
firejail \
    --net=none \
    --read-only=/etc \
    --whitelist=/tmp \
    --private \
    bun /tmp/untrusted_script.js 2>&1
EOF

# 2. Container Docker
cat > /tmp/Dockerfile.sandbox << 'EOF'
FROM oven/bun:alpine
RUN adduser -D -u 1000 sandbox
USER sandbox
WORKDIR /app
COPY --chown=sandbox:sandbox script.js .
CMD ["bun", "script.js"]
EOF
```

---

## Security Analysis

### Comparacao de Modelo de Permissao

| Feature | Bun | Deno | Node.js |
|---------|-----|------|---------|
| FS read | Livre | --allow-read | Livre |
| FS write | Livre | --allow-write | Livre |
| Network | Livre | --allow-net | Livre |
| Env vars | Livre | --allow-env | Livre |
| Subprocess | Livre | --allow-run | Livre |
| FFI | Livre | --allow-ffi | Via native addons |
| Syscalls diretos | Via FFI | Via FFI + --allow-ffi | Nao |

### Bypass de Sandbox do Deno via Bun

```bash
# Se voce tem acesso para executar Bun em um ambiente onde
# Deno esta "sandboxado", Bun pode ser usado para escapar:

# Cenario: sistema usa Deno com restricoes, mas Bun esta disponivel
which bun && bun -e "
const { execSync } = await import('bun');
// acessa sem restricoes
"
```

### Mitigacao Real

```bash
# O que REALMENTE restringe o Bun:
# 1. Permissoes de usuario Unix (DAC)
useradd -M -s /bin/false bun-sandbox
chmod 750 /app
chown root:bun-sandbox /app

# 2. AppArmor profile
cat /sys/kernel/security/apparmor/profiles | grep bun

# 3. Seccomp (mais restritivo)
systemd-run --no-ask-password \
    --property="SystemCallFilter=@system-service" \
    --property="MemoryMax=256M" \
    bun /app/script.js

# 4. Namespace isolation
unshare --net --pid --fork bun /app/script.js
```

---

## Exercises

### Ex S2.1 — Capability Test

```typescript
// Testar o que o Bun pode fazer sem restricoes
const capabilities = {
    "ler /etc/passwd": async () => {
        const f = await Bun.file("/etc/passwd").text();
        return `OK (${f.split("\n").length} linhas)`;
    },
    "ler /etc/shadow": async () => {
        return await Bun.file("/etc/shadow").text().then(
            t => `LIDO (${t.length} bytes)`,
            e => `BLOQUEADO: ${e.code}`
        );
    },
    "criar arquivo em /tmp": async () => {
        await Bun.write("/tmp/bun-test.txt", "teste");
        return "OK";
    },
    "fazer fetch externo": async () => {
        const r = await fetch("https://example.com");
        return `OK (${r.status})`;
    },
    "ler env vars": () => {
        return Object.keys(Bun.env).length + " variaveis";
    },
    "executar processo": async () => {
        const p = Bun.spawn(["id"]);
        return (await new Response(p.stdout).text()).trim();
    },
};

for (const [name, fn] of Object.entries(capabilities)) {
    try {
        const result = await fn();
        console.log(`[OK] ${name}: ${result}`);
    } catch (e) {
        console.log(`[BLOQUEADO] ${name}: ${e.message}`);
    }
}
```

### Ex S2.2 — Container Sandbox

```bash
# Criar ambiente sandboxado para executar scripts Bun nao-confiaveis
cat > /tmp/run_sandboxed.sh << 'EOF'
#!/bin/bash
SCRIPT=$1
[ -z "$SCRIPT" ] && echo "Uso: $0 <script.js>" && exit 1

# Verificar se Docker esta disponivel
if ! command -v docker &>/dev/null; then
    echo "Docker nao disponivel, usando firejail..."
    firejail --net=none --private bun "$SCRIPT" 2>/dev/null || \
        echo "Instale firejail para sandbox"
    exit
fi

# Criar imagem minima
cat > /tmp/Dockerfile.sbx << 'DEOF'
FROM oven/bun:alpine
RUN adduser -D -s /bin/sh -u 1001 runner
USER runner
WORKDIR /tmp
DEOF

docker build -t bun-sandbox -f /tmp/Dockerfile.sbx /tmp 2>/dev/null

# Executar com restricoes maximas
docker run --rm \
    --network=none \
    --memory=128m \
    --cpus=0.5 \
    --read-only \
    --tmpfs /tmp \
    -v "$SCRIPT:/tmp/script.js:ro" \
    bun-sandbox bun /tmp/script.js
EOF
chmod +x /tmp/run_sandboxed.sh
echo "Sandbox criado. Uso: /tmp/run_sandboxed.sh <script.js>"
```

### Ex S2.3 — Deno vs Bun Permission Diff

```bash
# Comparar comportamento de permissao
cat > /tmp/permission_test.js << 'EOF'
// Mesmo codigo, comportamento diferente
import fs from "fs/promises";

try {
    const content = await fs.readFile("/etc/passwd", "utf-8");
    console.log("Lido:", content.substring(0, 50));
} catch (e) {
    console.log("Bloqueado:", e.message);
}
EOF

echo "=== Bun (sem restricoes) ==="
bun /tmp/permission_test.js 2>&1

echo ""
echo "=== Deno (sem permissao) ==="
deno run /tmp/permission_test.js 2>&1 | head -5

echo ""
echo "=== Deno (com --allow-read=/etc/passwd) ==="
deno run --allow-read=/etc/passwd /tmp/permission_test.js 2>&1
```

---

## Checkpoint

[ ] Confirmou que Bun nao tem sandbox nativo
[ ] Comparou comportamento com Deno (que tem sandbox)
[ ] Executou Bun dentro de container Docker
[ ] Entende que a sandbox real deve vir do OS/container
[ ] Testou restricoes de seccomp/firejail com Bun

---

## Next

→ [`03-supply-chain`](../03-supply-chain/) — ataques de supply chain
