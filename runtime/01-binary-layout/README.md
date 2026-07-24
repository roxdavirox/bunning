# Binary Layout — Anatomia do Binario Bun

> ELF structure, sections, symbols, security features.

---

## Intuition (Feynman)

O binario `bun` e um arquivo executavel no formato ELF (Linux) ou Mach-O (macOS).
Imagine como um livro com capitulos: tem um indice no inicio (headers) que diz onde cada "capitulo" (section) comeca, e cada capitulo tem um proposito diferente (.text = codigo, .data = dados, .rodata = constantes).

---

## Source Code

No repositorio `oven-sh/bun`, o binario e gerado por:
```
build.zig          # Build system
src/
├── bun.zig        # Entry point
├── main.zig       # Alternative entry
└── ...
```

Zig compila para LLVM IR, depois para native code. Nao ha intermediario interpretado.

---

## Hands-On Analysis

### 1. ELF Headers

```bash
# Magic number e tipo
readelf -h $(which bun)

# Output esperado:
#   Class:                             ELF64
#   Type:                              DYN (Position-Independent Executable)
#   Machine:                           Advanced Micro Devices X86-64
#   Entry point address:               0x...
```

### 2. Sections

```bash
# Listar todas sections
readelf -S $(which bun) | head -40

# Sections importantes:
#   .text       - codigo executavel (RX)
#   .rodata     - read-only data (strings, constantes)
#   .data       - variaveis globais inicializadas
#   .bss        - variaveis globais nao-inicializadas
#   .plt/.got   - dynamic linking
```

### 3. Program Headers (Segmentos)

```bash
# Como o kernel carrega na memoria
readelf -l $(which bun)

# Segmentos:
#   LOAD          - mapeado na memoria
#   GNU_STACK     - configuracao da stack (NX)
#   GNU_RELRO     - read-only after relocation
```

### 4. Symbols

```bash
# Simbolos exportados (minimal em release)
nm -D $(which bun) | head -20

# Simbolos todos (debug build)
nm $(which bun) 2>/dev/null | wc -l

# Funcoes interessantes
objdump -t $(which bun) 2>/dev/null | grep -E "(main|init|eval)" | head -10
```

### 5. Strings

```bash
# Strings interessantes
strings $(which bun) | grep -E "(error|panic|assert)" | head -20
strings $(which bun) | grep -E "(version|bun)" | head -10
strings $(which bun) | grep -E "https?://" | head -10
```

---

## Security Features

```bash
checksec --file=$(which bun)
```

| Feature | Expected | Purpose |
|---------|----------|---------|
| RELRO | Full | Protect GOT/PLT |
| Stack Canary | Yes | Stack overflow detection |
| NX | Yes | Non-executable stack |
| PIE | Yes | ASLR compatibility |
| RPATH | No | Avoid library hijacking |
| RUNPATH | No | Avoid library hijacking |
| Fortify | Partial | Buffer overflow protection |

### Por que cada um importa

**RELRO (Relocation Read-Only):**
- GOT/PLT ficam read-only apos inicializacao
- Impede sobrescrever ponteiros de funcoes

**Stack Canary:**
- Valor aleatorio entre variaveis locais e return address
- Detecta stack buffer overflow

**NX (No-eXecute):**
- Stack e heap nao sao executaveis
- Impede shellcode direto

**PIE (Position Independent Executable):**
- Codigo pode rodar em qualquer endereco
- Habilita ASLR

---

## Cross-Runtime Comparison

| Feature | Node.js | Deno | Bun |
|---------|---------|------|-----|
| Binary size | ~50MB | ~100MB | ~50MB |
| Stripped | Yes (release) | Yes | Yes |
| Static linking | Mostly | Mostly | Mostly |
| RELRO | Full | Full | Full |
| PIE | Yes | Yes | Yes |
| Stack Canary | Yes | Yes | Yes |

---

## Exercises

### Ex 1.1 — ELF Header Analysis

```bash
# 1. Identifique o entry point do binario
readelf -h $(which bun) | grep "Entry"

# 2. O que esse endereco significa?
# Dica: e relativo ao base address (PIE)
```

### Ex 1.2 — Section Mapping

```bash
# 1. Qual o tamanho total de codigo (.text)?
readelf -S $(which bun) | grep ".text"

# 2. Qual a proporcao codigo vs dados?
size $(which bun)
```

### Ex 1.3 — Security Audit

```bash
# 1. Execute checksec e interprete cada feature
checksec --file=$(which bun)

# 2. Compare com Node.js
checksec --file=$(which node)

# 3. Alguma feature esta pior?
```

### Ex 1.4 — String Hunting

```bash
# 1. Encontre URLs hardcoded
strings $(which bun) | grep -E "https?://"

# 2. Encontre mensagens de erro
strings $(which bun) | grep -iE "error|fail|panic" | head -20

# 3. O que isso revela sobre internals?
```

---

## Security Implications

### O que podemos aprender do binario

1. **Versoes de bibliotecas** — strings pode revelar
2. **URLs de registro** — onde busca packages
3. **Mensagens de erro** — hints sobre codigo
4. **Funcoes exportadas** — API surface

### Attack Surface

- Binario PIE com ASLR e mais dificil de explorar
- Mas se tiver info leak, PIE nao ajuda
- Canaries protegem stack mas nao heap
- RELRO protege GOT mas nao outros ponteiros

---

## Checkpoint

[ ] `readelf -h` mostra ELF64, PIE
[ ] `readelf -S` identifica .text, .rodata, .data
[ ] `checksec` mostra Full RELRO, Canary, NX, PIE
[ ] Strings revelam info interessante (versoes, URLs)

---

## Next

→ [`02-zig-runtime`](../02-zig-runtime/) — como Zig estrutura o codigo
