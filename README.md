# Bun Deep Learning: Feynman Method + Internals + Reverse Engineering

> "What I cannot create, I do not understand." — Richard Feynman

## Objetivo

Estudo profundo do Bun runtime — do source code Zig ate syscalls, com vies de seguranca ofensiva e engenharia reversa. Nao e tutorial de uso; e disseccao completa.

## Trilha linear (do binario ao exploit)

Este `README.md` lista os modulos. A **ordem de estudo** esta em **[STUDY_PATH.md](./STUDY_PATH.md)** (8 fases, ~200-250h, binario → runtime → internals → FFI → hooks → security → fuzzing → exploit dev).

### Hands-on artifacts

- [`samples/`](./samples/) — Exemplos que exploram internals do Bun (memory layout, FFI abuse, hook injection)
- [`exploits/`](./exploits/) — PoCs de vulnerabilidades conhecidas + hipoteticas
- [`CVE_INTEL.md`](./CVE_INTEL.md) — Indice curado de CVEs e security advisories do Bun
- [`LAB_SETUP.md`](./LAB_SETUP.md) — Ambiente de debug, ASAN builds, fuzzing infra
- [`PEER_BENCHMARK.md`](./PEER_BENCHMARK.md) — Comparacao vs Node.js, Deno internals research

## Methodology

Cada conceito segue esta estrutura:
1. **Intuition** (Feynman simple explanation)
2. **Source Code** (onde vive no repo oven-sh/bun)
3. **Binary Analysis** (objdump, radare2, strace)
4. **Cross-Runtime Comparison** (Node.js V8, Deno, browser)
5. **Security Implications** (attack surface, mitigations)
6. **Exploit Potential** (what could go wrong)

## Core Modules

### Runtime Architecture
- [Binary Layout](./runtime/01-binary-layout/README.md) — ELF structure, sections, symbols
- [Zig Runtime](./runtime/02-zig-runtime/README.md) — allocator, safety checks, panic handlers
- [JavaScriptCore](./runtime/03-jsc-integration/README.md) — JSC embedding, JIT, GC
- [Event Loop](./runtime/04-event-loop/README.md) — libuv alternative, io_uring, epoll
- [Module Resolution](./runtime/05-module-resolution/README.md) — ESM, CJS, Bun-specific

### Memory & Allocations
- [Allocator Internals](./memory/01-allocator/README.md) — mimalloc, arena patterns
- [GC Interaction](./memory/02-gc/README.md) — JSC GC, weak refs, marking
- [Buffer Handling](./memory/03-buffers/README.md) — ArrayBuffer, SharedArrayBuffer
- [Memory Safety](./memory/04-safety/README.md) — bounds checks, use-after-free patterns

### FFI & Native Code
- [Bun:FFI](./ffi/01-bun-ffi/README.md) — dlopen, symbol resolution, calling conventions
- [Native Plugins](./ffi/02-native-plugins/README.md) — N-API compatibility layer
- [Zig Bindings](./ffi/03-zig-bindings/README.md) — comptime, extern, @cImport
- [Syscall Interface](./ffi/04-syscalls/README.md) — direct syscalls vs libc

### HTTP & Networking
- [HTTP Server](./http/01-server/README.md) — uWebSockets.js integration
- [Fetch Implementation](./http/02-fetch/README.md) — HTTP client internals
- [WebSocket](./http/03-websocket/README.md) — upgrade, framing, extensions
- [TLS Stack](./http/04-tls/README.md) — BoringSSL integration, cert handling

### Bundler & Transpiler
- [Parser](./bundler/01-parser/README.md) — Zig-based JS/TS parser
- [AST](./bundler/02-ast/README.md) — node types, source maps
- [Tree Shaking](./bundler/03-tree-shaking/README.md) — dead code elimination
- [Minification](./bundler/04-minification/README.md) — name mangling, scope analysis

### Package Management
- [Registry Protocol](./package/01-registry/README.md) — npm protocol implementation
- [Lockfile Format](./package/02-lockfile/README.md) — bun.lockb binary format
- [Cache Structure](./package/03-cache/README.md) — global cache layout
- [Install Hooks](./package/04-hooks/README.md) — lifecycle scripts, security

### Security Analysis
- [Attack Surface](./security/01-attack-surface/README.md) — entry points, trust boundaries
- [Sandbox Escapes](./security/02-sandbox/README.md) — what Bun doesn't sandbox
- [Supply Chain](./security/03-supply-chain/README.md) — install script risks
- [CVE Analysis](./security/04-cve-analysis/README.md) — historical vulns
- [Fuzzing](./security/05-fuzzing/README.md) — AFL++, libFuzzer, corpus

### Reverse Engineering
- [Static Analysis](./reverse/01-static/README.md) — symbols, strings, sections
- [Dynamic Analysis](./reverse/02-dynamic/README.md) — strace, ltrace, gdb
- [Hook Points](./reverse/03-hooks/README.md) — LD_PRELOAD, ptrace injection
- [Zig-Specific](./reverse/04-zig-specific/README.md) — Zig patterns in binaries

## Papers & References

| Topic | Reference | Relevance |
|-------|-----------|-----------|
| JSC Internals | WebKit blog posts | JIT compilation, GC |
| Zig Safety | Zig language reference | Bounds checking, undefined behavior |
| io_uring | Axboe 2019 | Async I/O internals |
| mimalloc | Leijen et al. 2019 | Allocator design |
| JIT Attacks | Athanasakis et al. 2015 (JIT-ROP) | Code injection via JIT |
| Supply Chain | Ohm et al. 2020 | npm ecosystem risks |

## Project Structure

```
bunning/
├── README.md               # This file
├── STUDY_PATH.md          # Linear study order
├── CVE_INTEL.md           # Security advisories index
├── LAB_SETUP.md           # Debug/fuzzing environment
├── PEER_BENCHMARK.md      # vs Node/Deno comparison
├── PAPERS.md              # Academic references
├── runtime/               # Core runtime modules
│   ├── 01-binary-layout/
│   ├── 02-zig-runtime/
│   ├── 03-jsc-integration/
│   ├── 04-event-loop/
│   └── 05-module-resolution/
├── memory/                # Memory subsystem
│   ├── 01-allocator/
│   ├── 02-gc/
│   ├── 03-buffers/
│   └── 04-safety/
├── ffi/                   # Foreign function interface
│   ├── 01-bun-ffi/
│   ├── 02-native-plugins/
│   ├── 03-zig-bindings/
│   └── 04-syscalls/
├── http/                  # Networking stack
│   ├── 01-server/
│   ├── 02-fetch/
│   ├── 03-websocket/
│   └── 04-tls/
├── bundler/               # Transpiler/bundler
│   ├── 01-parser/
│   ├── 02-ast/
│   ├── 03-tree-shaking/
│   └── 04-minification/
├── package/               # Package manager
│   ├── 01-registry/
│   ├── 02-lockfile/
│   ├── 03-cache/
│   └── 04-hooks/
├── security/              # Security analysis
│   ├── 01-attack-surface/
│   ├── 02-sandbox/
│   ├── 03-supply-chain/
│   ├── 04-cve-analysis/
│   └── 05-fuzzing/
├── reverse/               # Reverse engineering
│   ├── 01-static/
│   ├── 02-dynamic/
│   ├── 03-hooks/
│   └── 04-zig-specific/
├── samples/               # Working examples
├── exploits/              # PoC exploits
└── exercises/             # Progressive exercises
```

## Installed Tools

| Tool | Purpose | Status |
|------|---------|--------|
| objdump, nm, readelf | Static ELF analysis | binutils |
| radare2, rizin | Advanced disassembly | installed |
| strace, ltrace | Syscall/library tracing | installed |
| gdb, lldb | Debugging | installed |
| AFL++, libFuzzer | Fuzzing | to install |
| Frida | Dynamic instrumentation | to install |
| checksec | Binary security checks | installed |

## Quick Start

```bash
# 1. Get Bun binary
which bun && bun --version

# 2. Analyze binary structure
readelf -a $(which bun) | head -100
objdump -d $(which bun) | grep -A 20 "main>"

# 3. Trace syscalls
strace -f bun run script.js 2>&1 | head -50

# 4. Check security features
checksec --file=$(which bun)

# 5. Strings analysis (find interesting patterns)
strings $(which bun) | grep -E "(error|panic|assert)" | head -20

# 6. Build debug version (requires Zig)
git clone https://github.com/oven-sh/bun
cd bun && zig build -Doptimize=Debug
```

## Cross-Runtime Comparisons

Every module includes comparison with:
- **Node.js** — V8, libuv, npm
- **Deno** — V8, Rust, permissions model
- **Browser** — Same JSC (Safari), different security model
- **Bun** — JSC, Zig, no sandbox

## License

MIT OR Apache-2.0
