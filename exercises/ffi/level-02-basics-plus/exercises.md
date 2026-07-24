# FFI — Level 02: Basics Plus (1 exercício)

## Ex 2.1 — libc Direct Access

### Objetivo
Acessar funções da libc diretamente via FFI.

### Skills
- libc functions
- System information
- FFIType.ptr handling

### Tarefa

1. Crie script para acessar libc:
```bash
cat > /tmp/ffi-lab/libc.ts << 'EOF'
import { dlopen, FFIType, ptr, CString } from "bun:ffi";

const libc = dlopen("libc.so.6", {
  getpid: {
    args: [],
    returns: FFIType.i32,
  },
  getuid: {
    args: [],
    returns: FFIType.i32,
  },
  geteuid: {
    args: [],
    returns: FFIType.i32,
  },
  getenv: {
    args: [FFIType.cstring],
    returns: FFIType.ptr,
  },
  gethostname: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.i32,
  },
  time: {
    args: [FFIType.ptr],
    returns: FFIType.i64,
  },
});

// System info
console.log("PID:", libc.symbols.getpid());
console.log("UID:", libc.symbols.getuid());
console.log("EUID:", libc.symbols.geteuid());

// Environment variable
const homePtr = libc.symbols.getenv("HOME");
if (homePtr) {
  const home = new CString(homePtr);
  console.log("HOME:", home.toString());
}

// Hostname
const hostbuf = new Uint8Array(256);
libc.symbols.gethostname(ptr(hostbuf), BigInt(hostbuf.length));
const hostname = new CString(ptr(hostbuf));
console.log("Hostname:", hostname.toString());

// Unix timestamp
const timestamp = libc.symbols.time(null);
console.log("Unix time:", timestamp);
EOF
```

2. Execute e compare com comandos shell:
```bash
bun run /tmp/ffi-lab/libc.ts

# Compare
echo "Shell PID: $$"
id
hostname
date +%s
```

### Entrega

- [ ] Script funcional acessando 5+ funções libc
- [ ] Output correto comparado com comandos shell
- [ ] Explicação de como CString funciona
- [ ] Tratamento de ponteiro nulo para getenv

### Perguntas

1. O que acontece se getenv retornar NULL?
2. Por que gethostname precisa de BigInt para o tamanho?
3. Qual a diferença entre UID e EUID?

### Verificação

```bash
# PID deve ser diferente do shell
BUN_PID=$(bun -e "import{dlopen,FFIType}from'bun:ffi';console.log(dlopen('libc.so.6',{getpid:{args:[],returns:FFIType.i32}}).symbols.getpid())")
[ "$BUN_PID" != "$$" ] && echo "PASS" || echo "FAIL"
```

### Tempo estimado
1.5 horas

### Próximo
→ Level 03: Memory Operations
