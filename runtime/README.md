# Runtime — Bun Core Runtime Modules

> Arquitetura do runtime: binario, Zig, JSC, event loop.

---

## Modulos

| # | Modulo | Topico | Horas |
|---|--------|--------|-------|
| 01 | [binary-layout](./01-binary-layout/) | ELF structure, sections, symbols | 4h |
| 02 | [zig-runtime](./02-zig-runtime/) | Zig patterns, allocator, panic | 6h |
| 03 | [jsc-integration](./03-jsc-integration/) | JavaScriptCore embedding, JIT | 8h |
| 04 | [event-loop](./04-event-loop/) | io_uring, epoll, async model | 6h |
| 05 | [module-resolution](./05-module-resolution/) | ESM, CJS, Bun-specific | 4h |

---

## Fluxo de Execucao

```
bun run script.js
    │
    ▼
main() in bun.zig
    │
    ├── Parse CLI args
    ├── Initialize allocator (mimalloc)
    ├── Initialize JSC
    │       │
    │       ▼
    │   Create JSGlobalObject
    │   Setup builtins
    │       │
    ├── Resolve module
    │       │
    │       ▼
    │   js_parser.zig
    │   bundler.zig (if needed)
    │       │
    ├── Evaluate
    │       │
    │       ▼
    │   JSC::evaluate()
    │       │
    └── Event loop
            │
            ▼
        io_uring/epoll
            │
            ▼
        Process completions
        Run callbacks
        Repeat
```

---

## Prerequisitos

- Fase 1 completa (binario)
- Conhecimento basico de assembly x86-64
- Familiaridade com async I/O concepts

---

## Cross-Reference

- `STUDY_PATH.md` Fase 1-2
- `INTERNALS_MAP.md` — onde cada arquivo vive
- `COMPARATIVE.md` — vs Node/Deno runtime
