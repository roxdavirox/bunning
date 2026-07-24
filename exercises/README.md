# Exercises — Progressive Bun Internals

> 120+ exercicios progressivos, escala Fibonacci por nivel.
> Foco: reverse engineering, security analysis, exploit development.

---

## Estrutura

```
exercises/
├── README.md (este arquivo)
├── runtime/
│   ├── level-01-basics/         (1 ex)
│   ├── level-02-basics-plus/    (1 ex)
│   ├── level-03-intermediate/   (2 ex)
│   ├── level-04-intermediate+/  (3 ex)
│   ├── level-05-advanced/       (5 ex)
│   ├── level-06-challenging/    (8 ex)
│   └── level-07-expert/         (13 ex)   = 33 ex
├── ffi/                         = 33 ex
├── security/                    = 33 ex
└── reverse/                     = 33 ex
```

---

## Track: Runtime (33 exercicios)

### Level 01 — Basics (1 exercicio)

**Ex 1.1 — Binary Anatomy**
- Objetivo: Analisar estrutura ELF do binario Bun
- Skills: readelf, objdump
- Entrega: Report com sections, entry point, security features

### Level 02 — Basics Plus (1 exercicio)

**Ex 2.1 — Syscall Trace**
- Objetivo: Tracar syscalls de `bun --version`
- Skills: strace, syscall identification
- Entrega: Lista de syscalls com interpretacao

### Level 03 — Intermediate (2 exercicios)

**Ex 3.1 — Memory Mapping**
- Objetivo: Analisar /proc/[pid]/maps de processo Bun rodando
- Skills: memory regions, heap/stack identification
- Entrega: Diagrama de memoria anotado

**Ex 3.2 — Event Loop Observation**
- Objetivo: Identificar io_uring vs epoll via strace
- Skills: async I/O syscalls
- Entrega: Comparacao io_uring vs epoll

### Level 04 — Intermediate Plus (3 exercicios)

**Ex 4.1 — JSC Heap Analysis**
- Objetivo: Usar `Bun.gc()` e observar comportamento
- Skills: GC triggers, memory pressure
- Entrega: Script + medicoes

**Ex 4.2 — Startup Profiling**
- Objetivo: Medir tempo de cada fase do startup
- Skills: perf, flamegraph
- Entrega: Flamegraph anotado

**Ex 4.3 — Module Resolution**
- Objetivo: Tracar como Bun resolve imports
- Skills: strace openat, resolution algorithm
- Entrega: Diagrama de resolucao

### Level 05 — Advanced (5 exercicios)

**Ex 5.1 — Source Map Parsing**
- Objetivo: Analisar como Bun gera source maps
- Skills: source map format, debugging
- Entrega: Analise de output

**Ex 5.2 — HTTP Parser Internals**
- Objetivo: Tracing de parsing HTTP
- Skills: uWebSockets analysis
- Entrega: Diagrama de parsing

**Ex 5.3 — WebSocket Frame Analysis**
- Objetivo: Capturar e decodificar frames WebSocket
- Skills: Wireshark, frame format
- Entrega: Frames anotados

**Ex 5.4 — Bundler Algorithm**
- Objetivo: Entender tree-shaking do bundler
- Skills: AST analysis
- Entrega: Report de dead code detection

**Ex 5.5 — TLS Handshake**
- Objetivo: Capturar TLS handshake de fetch()
- Skills: Wireshark, SSLKEYLOGFILE
- Entrega: Handshake decifrado

### Level 06 — Challenging (8 exercicios)

**Ex 6.1 — JIT Analysis**
- Objetivo: Identificar codigo JIT-compilado
- Skills: JSC debugging flags
- Entrega: Assembly de funcao hot

**Ex 6.2 — Allocator Profiling**
- Objetivo: Analisar mimalloc behavior
- Skills: memory profiling
- Entrega: Allocation patterns

**Ex 6.3 — Lockfile Reverse**
- Objetivo: Entender formato binario de bun.lockb
- Skills: hex analysis, format reverse
- Entrega: Documentacao parcial do formato

**Ex 6.4 — Registry Protocol**
- Objetivo: Capturar protocolo npm registry
- Skills: HTTP interception
- Entrega: Request/response examples

**Ex 6.5 — Process Spawning**
- Objetivo: Analisar Bun.spawn() internals
- Skills: fork/exec tracing
- Entrega: Flow diagram

**Ex 6.6 — File Watcher**
- Objetivo: Entender como Bun.watch funciona
- Skills: inotify/FSEvents analysis
- Entrega: Event flow

**Ex 6.7 — Error Handling**
- Objetivo: Mapear error paths no source
- Skills: source code reading
- Entrega: Error hierarchy

**Ex 6.8 — Node.js Compat Layer**
- Objetivo: Identificar shims de compatibilidade
- Skills: diff vs Node API
- Entrega: Compatibility matrix

### Level 07 — Expert (13 exercicios)

**Ex 7.1-7.13** — Projetos de exploracao profunda cobrindo:
- JSC bytecode analysis
- Zig runtime patterns
- Cross-platform differences
- Performance bottlenecks
- Memory leak hunting
- Crash analysis
- Custom instrumentation
- Build system deep dive
- Test infrastructure
- CI/CD pipeline
- Release engineering
- Upgrade path analysis
- Regression hunting

---

## Track: FFI (33 exercicios)

### Progressao

1. **Basics (1-2):** Hello FFI, load libc
2. **Intermediate (3-5):** Structs, callbacks, memory
3. **Advanced (6-13):** Direct syscalls, exploitation
4. **Expert (14-33):** Zero-day research, harness building

### Highlights

**Ex FFI.5 — Arbitrary Code Execution**
- Objetivo: Demonstrar RCE via FFI
- Sandbox: Obrigatorio
- Skills: execve, shellcode

**Ex FFI.10 — Capability Bypass**
- Objetivo: Escapar restricoes via FFI
- Skills: Linux capabilities, seccomp bypass

**Ex FFI.15 — Memory Corruption**
- Objetivo: Trigger heap corruption via FFI misuse
- Skills: ASAN, debugging

---

## Track: Security (33 exercicios)

### Progressao

1. **Basics (1-2):** Attack surface mapping
2. **Intermediate (3-5):** Input validation, fuzzing setup
3. **Advanced (6-13):** CVE reproduction, exploit dev
4. **Expert (14-33):** Zero-day hunting, disclosure

### Highlights

**Ex SEC.3 — Parser Fuzzing**
- Objetivo: Setup AFL++ para fuzzing do parser
- Tools: AFL++, corpus
- Entrega: Corpus + crashes

**Ex SEC.8 — CVE Reproduction**
- Objetivo: Reproduzir CVE conhecido do Bun/JSC
- Skills: Root cause analysis
- Entrega: PoC + writeup

**Ex SEC.15 — Supply Chain Attack Simulation**
- Objetivo: Criar package malicioso (em sandbox)
- Skills: npm publishing, postinstall
- Entrega: Attack chain documentation

**Ex SEC.25 — Zero-Day Hunt**
- Objetivo: Encontrar bug novo via code review + fuzzing
- Duration: ~20h
- Entrega: Report (responsible disclosure se encontrar)

---

## Track: Reverse Engineering (33 exercicios)

### Progressao

1. **Basics (1-2):** ELF structure, strings
2. **Intermediate (3-5):** Symbol analysis, call graph
3. **Advanced (6-13):** Dynamic analysis, hooking
4. **Expert (14-33):** Full binary analysis, patching

### Highlights

**Ex RE.5 — Function Identification**
- Objetivo: Identificar funcoes importantes sem simbolos
- Skills: Pattern matching, heuristics
- Tools: radare2, Ghidra

**Ex RE.10 — Zig Pattern Recognition**
- Objetivo: Identificar patterns Zig no assembly
- Skills: Comptime artifacts, safety checks
- Entrega: Pattern catalog

**Ex RE.20 — Binary Patching**
- Objetivo: Patch binario para alterar comportamento
- Skills: hex editing, assembly
- Sandbox: Obrigatorio
- Entrega: Patched binary + documentation

---

## Fibonacci Scaling

| Level | Exercises | Cumulative | Hours (est) |
|-------|-----------|------------|-------------|
| 01 | 1 | 1 | 1h |
| 02 | 1 | 2 | 2h |
| 03 | 2 | 4 | 4h |
| 04 | 3 | 7 | 6h |
| 05 | 5 | 12 | 10h |
| 06 | 8 | 20 | 16h |
| 07 | 13 | 33 | 26h |
| **Total** | **33** | | **~65h/track** |

4 tracks x 65h = **~260h total**

---

## Validation

Cada exercicio tem:
- **Objective:** O que fazer
- **Skills:** O que aprende
- **Deliverable:** O que entregar
- **Checkpoint:** Como validar

### Auto-avaliacao

```
[ ] Consegui completar?
[ ] Entendi por que funciona?
[ ] Posso explicar para outro?
[ ] Tenho entrega documentada?
```

---

## Setup

```bash
# Pre-requisitos
sudo apt install binutils strace gdb radare2 afl++

# Clone este repo
git clone [bunning repo]
cd bunning/exercises

# Verificar
./check-setup.sh
```

---

## Cross-Reference

- `STUDY_PATH.md` — ordem recomendada
- `LAB_SETUP.md` — ambiente de lab
- `CVE_INTEL.md` — CVEs para reproduzir
- `MAGO_HARNESS.md` — aplicar conhecimento
