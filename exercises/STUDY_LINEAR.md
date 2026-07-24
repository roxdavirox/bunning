# STUDY_LINEAR — Checklist de Estudo Bunning

> Versão checkbox do STUDY_PATH.md para tracking de progresso.

---

## Fase 0 — Setup (4h)

- [ ] Bun instalado (`bun --version`)
- [ ] Tools instalados (binutils, strace, gdb, radare2)
- [ ] Clone do repo oven-sh/bun
- [ ] `checksec --file=$(which bun)` funciona

---

## Fase 1 — Binary Anatomy (25h)

### Exercícios
- [ ] Ex 1.1 — Binary First Contact

### Módulos
- [ ] runtime/01-binary-layout
- [ ] reverse/01-static
- [ ] reverse/04-zig-specific

### Checkpoint
- [ ] Explico output de `readelf -S` linha por linha
- [ ] Identifico security features do binário
- [ ] Encontro strings interessantes

---

## Fase 2 — Runtime Core (35h)

### Exercícios
- [ ] Ex 2.1 — Syscall Tracing
- [ ] Ex 3.1 — Memory Layout Analysis
- [ ] Ex 3.2 — Event Loop Observation

### Módulos
- [ ] runtime/02-zig-runtime
- [ ] runtime/03-jsc-integration
- [ ] runtime/04-event-loop

### Checkpoint
- [ ] Tracing de `bun run` completo
- [ ] Identifico se usa io_uring ou epoll
- [ ] Entendo inicialização JSC

---

## Fase 3 — Memory Subsystem (25h)

### Módulos
- [ ] memory/01-allocator
- [ ] memory/02-gc
- [ ] memory/03-buffers
- [ ] memory/04-safety

### Checkpoint
- [ ] Identifico memory leak potencial no source
- [ ] Entendo mimalloc integration
- [ ] Mapeio JSC GC behavior

---

## Fase 4 — FFI & Syscalls (30h)

### Exercícios
- [ ] Ex FFI 1.1 — Hello FFI
- [ ] Ex FFI 2.1 — libc Direct Access

### Módulos
- [ ] ffi/01-bun-ffi
- [ ] ffi/02-native-plugins
- [ ] ffi/03-zig-bindings
- [ ] ffi/04-syscalls

### Checkpoint
- [ ] FFI call para biblioteca C própria
- [ ] Acesso libc.so.6 direto
- [ ] Syscall raw funcionando

---

## Fase 5 — HTTP & Network (25h)

### Módulos
- [ ] http/01-server
- [ ] http/02-fetch
- [ ] http/03-websocket
- [ ] http/04-tls

### Checkpoint
- [ ] Captura TLS handshake com Wireshark
- [ ] Entendo uWebSockets.js integration
- [ ] Analiso HTTP parser

---

## Fase 6 — Bundler & Transpiler (20h)

### Módulos
- [ ] bundler/01-parser
- [ ] bundler/02-ast
- [ ] bundler/03-tree-shaking
- [ ] bundler/04-minification

### Checkpoint
- [ ] Input malformado causa erro controlado
- [ ] Entendo parsing pipeline
- [ ] Identifico edge cases Unicode

---

## Fase 7 — Package Manager (20h)

### Módulos
- [ ] package/01-registry
- [ ] package/02-lockfile
- [ ] package/03-cache
- [ ] package/04-hooks

### Checkpoint
- [ ] Entendo bun.lockb format
- [ ] Package com hook malicioso testado (sandbox)
- [ ] Capturo protocol npm registry

---

## Fase 8 — Security & Exploitation (50h)

### Exercícios
- [ ] Ex SEC 1.1 — Attack Surface Mapping

### Módulos
- [ ] security/01-attack-surface
- [ ] security/02-sandbox
- [ ] security/03-supply-chain
- [ ] security/04-cve-analysis
- [ ] security/05-fuzzing

### Checkpoint
- [ ] Attack surface documentado
- [ ] Entendo o que Bun NÃO tem (sandbox)
- [ ] CVE reproduzido OU crash via fuzzing

---

## Verificação Final

| Fase | Status |
|------|--------|
| 0 | ⬜ |
| 1 | ⬜ |
| 2 | ⬜ |
| 3 | ⬜ |
| 4 | ⬜ |
| 5 | ⬜ |
| 6 | ⬜ |
| 7 | ⬜ |
| 8 | ⬜ |

**Total: ___/234h**

---

## Notas de Progresso

```
Data: ____-__-__
Fase atual: __
Horas investidas: __
Próximo passo: _______________
```
