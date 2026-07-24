# Samples — Bun Code Examples

> Exemplos funcionais demonstrando internals e técnicas.

---

## Estrutura

```
samples/
├── ffi/
│   ├── hello-c.ts          # FFI básico
│   ├── libc-direct.ts      # Acesso libc
│   ├── syscalls.ts         # Syscalls raw
│   └── memory-ops.ts       # Operações de memória
├── http/
│   ├── minimal-server.ts   # HTTP server mínimo
│   ├── websocket.ts        # WebSocket server
│   └── fetch-trace.ts      # Trace de fetch
├── runtime/
│   ├── gc-observer.ts      # Observar GC
│   ├── event-loop.ts       # Event loop demo
│   └── jit-warmup.ts       # JIT optimization
└── security/
    ├── attack-surface.ts   # Demonstrar superfície
    └── sandbox-escape.ts   # (Conceitual) escape
```

---

## Quick Start

```bash
# Executar qualquer sample
cd /home/rx/lab/bunning/samples
bun run ffi/hello-c.ts
```
