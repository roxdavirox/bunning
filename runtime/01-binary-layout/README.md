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

ELF Header:
Magic: 7f 45 4c 46 02 01 01 00 00 00 00 00 00 00 00 00
Class: ELF64
Data: 2's complement, little endian
Version: 1 (current)
OS/ABI: UNIX - System V
ABI Version: 0
Type: EXEC (Executable file)
Machine: Advanced Micro Devices X86-64
Version: 0x1
Entry point address: 0x24c7e00
Start of program headers: 64 (bytes into file)
Start of section headers: 92750384 (bytes into file)
Flags: 0x0
Size of this header: 64 (bytes)
Size of program headers: 56 (bytes)
Number of program headers: 9
Size of section headers: 64 (bytes)
Number of section headers: 37

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

There are 37 section headers, starting at offset 0x5874230:

Section Headers:
  [Nr] Name              Type             Address           Offset
       Size              EntSize          Flags  Link  Info  Align
  [ 0]                   NULL             0000000000000000  00000000
       0000000000000000  0000000000000000           0     0     0
  [ 1] .interp           PROGBITS         0000000000200238  00000238
       000000000000001c  0000000000000000   A       0     0     1
  [ 2] .note.ABI-tag     NOTE             0000000000200254  00000254
       0000000000000020  0000000000000000   A       0     0     4
  [ 3] .note.gnu.bu[...] NOTE             0000000000200274  00000274
       0000000000000024  0000000000000000   A       0     0     4
  [ 4] .dynsym           DYNSYM           0000000000200298  00000298
       0000000000005bf8  0000000000000018   A      10     1     8
  [ 5] .gnu.version      VERSYM           0000000000205e90  00005e90
       00000000000007aa  0000000000000002   A       4     0     2
  [ 6] .gnu.version_d    VERDEF           000000000020663c  0000663c
       0000000000000038  0000000000000000   A      10     2     4
  [ 7] .gnu.version_r    VERNEED          0000000000206674  00006674
       0000000000000170  0000000000000000   A      10     5     4
  [ 8] .gnu.hash         GNU_HASH         00000000002067e8  000067e8
       0000000000000ef8  0000000000000000   A       4     0     8
  [ 9] .hash             HASH             00000000002076e0  000076e0
       0000000000001eb0  0000000000000004   A       4     0     4
  [10] .dynstr           STRTAB           0000000000209590  00009590
       00000000000040ed  0000000000000000   A       0     0     1
  [11] .rela.dyn         RELA             000000000020d680  0000d680
       0000000000000648  0000000000000018   A       4     0     8
  [12] .rela.plt         RELA             000000000020dcc8  0000dcc8
       00000000000026a0  0000000000000018  AI       4    30     8
  [13] .rodata           PROGBITS         0000000000211000  00011000
       0000000002054190  0000000000000000 AMS       0     0     4096
  [14] .text             PROGBITS         00000000024c7e00  02067e00
       00000000037cb10a  0000000000000000  AX       0     0     512
  [15] .init             PROGBITS         0000000005c92f0c  05832f0c
       000000000000001b  0000000000000000  AX       0     0     4
  [16] .fini             PROGBITS         0000000005c92f28  05832f28
       000000000000000d  0000000000000000  AX       0     0     4
  [17] .plt              PROGBITS         0000000005c92f40  05832f40
```

### 3. Program Headers (Segmentos)

```bash
# Como o kernel carrega na memoria
readelf -l $(which bun)

# Segmentos:
#   LOAD          - mapeado na memoria
#   GNU_STACK     - configuracao da stack (NX)
#   GNU_RELRO     - read-only after relocation

There are 37 section headers, starting at offset 0x5874230:

Section Headers:
  [Nr] Name              Type             Address           Offset
       Size              EntSize          Flags  Link  Info  Align
  [ 0]                   NULL             0000000000000000  00000000
       0000000000000000  0000000000000000           0     0     0
  [ 1] .interp           PROGBITS         0000000000200238  00000238
       000000000000001c  0000000000000000   A       0     0     1
  [ 2] .note.ABI-tag     NOTE             0000000000200254  00000254
       0000000000000020  0000000000000000   A       0     0     4
  [ 3] .note.gnu.bu[...] NOTE             0000000000200274  00000274
       0000000000000024  0000000000000000   A       0     0     4
  [ 4] .dynsym           DYNSYM           0000000000200298  00000298
       0000000000005bf8  0000000000000018   A      10     1     8
  [ 5] .gnu.version      VERSYM           0000000000205e90  00005e90
       00000000000007aa  0000000000000002   A       4     0     2
  [ 6] .gnu.version_d    VERDEF           000000000020663c  0000663c
       0000000000000038  0000000000000000   A      10     2     4
  [ 7] .gnu.version_r    VERNEED          0000000000206674  00006674
       0000000000000170  0000000000000000   A      10     5     4
  [ 8] .gnu.hash         GNU_HASH         00000000002067e8  000067e8
       0000000000000ef8  0000000000000000   A       4     0     8
  [ 9] .hash             HASH             00000000002076e0  000076e0
       0000000000001eb0  0000000000000004   A       4     0     4
  [10] .dynstr           STRTAB           0000000000209590  00009590
       00000000000040ed  0000000000000000   A       0     0     1
  [11] .rela.dyn         RELA             000000000020d680  0000d680
       0000000000000648  0000000000000018   A       4     0     8
  [12] .rela.plt         RELA             000000000020dcc8  0000dcc8
       00000000000026a0  0000000000000018  AI       4    30     8
  [13] .rodata           PROGBITS         0000000000211000  00011000
       0000000002054190  0000000000000000 AMS       0     0     4096
  [14] .text             PROGBITS         00000000024c7e00  02067e00
       00000000037cb10a  0000000000000000  AX       0     0     512
  [15] .init             PROGBITS         0000000005c92f0c  05832f0c
       000000000000001b  0000000000000000  AX       0     0     4
  [16] .fini             PROGBITS         0000000005c92f28  05832f28
       000000000000000d  0000000000000000  AX       0     0     4
  [17] .plt              PROGBITS         0000000005c92f40  05832f40
```

### 4. Symbols

```bash
# Simbolos exportados (minimal em release)
nm -D $(which bun) | head -20
                 w ZSTD_trace_compress_begin
                 w ZSTD_trace_compress_end
                 w ZSTD_trace_decompress_begin
                 w ZSTD_trace_decompress_end
                 w _ITM_deregisterTMCloneTable
                 w _ITM_registerTMCloneTable
00000000042e2340 T _ZN2v811HandleScope12CreateHandleEPNS_8internal7IsolateEm@@BUN_1.2
00000000042e0910 T _ZN2v811HandleScopeC1EPNS_7IsolateE@@BUN_1.2
00000000042e0910 T _ZN2v811HandleScopeC2EPNS_7IsolateE@@BUN_1.2
00000000042e08b0 T _ZN2v811HandleScopeD1Ev@@BUN_1.2
00000000042e08b0 T _ZN2v811HandleScopeD2Ev@@BUN_1.2
00000000042e88f0 T _ZN2v812api_internal12ToLocalEmptyEv@@BUN_1.2
00000000042e89b0 T _ZN2v812api_internal13DisposeGlobalEPm@@BUN_1.2
00000000042e8910 T _ZN2v812api_internal17FromJustIsNothingEv@@BUN_1.2
00000000042e8930 T _ZN2v812api_internal18GlobalizeReferenceEPNS_8internal7IsolateEm@@BUN_1.2
00000000042e89c0 T _ZN2v812api_internal23GetFunctionTemplateDataEPNS_7IsolateENS_5LocalINS_4DataEEE@@BUN_1.2
00000000042e4570 T _ZN2v814ObjectTemplate11NewInstanceENS_5LocalINS_7ContextEEE@@BUN_1.2
00000000042e4ba0 T _ZN2v814ObjectTemplate21SetInternalFieldCountEi@@BUN_1.2
00000000042e3df0 T _ZN2v814ObjectTemplate3NewEPNS_7IsolateENS_5LocalINS_16FunctionTemplateEEE@@BUN_1.2
00000000042e1a80 T _ZN2v816FunctionTemplate11GetFunctionENS_5LocalINS_7ContextEEE@@BUN_1.2

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

| Feature      | Expected | Purpose                    |
| ------------ | -------- | -------------------------- |
| RELRO        | Full     | Protect GOT/PLT            |
| Stack Canary | Yes      | Stack overflow detection   |
| NX           | Yes      | Non-executable stack       |
| PIE          | Yes      | ASLR compatibility         |
| RPATH        | No       | Avoid library hijacking    |
| RUNPATH      | No       | Avoid library hijacking    |
| Fortify      | Partial  | Buffer overflow protection |

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

| Feature        | Node.js       | Deno   | Bun    |
| -------------- | ------------- | ------ | ------ |
| Binary size    | ~50MB         | ~100MB | ~50MB  |
| Stripped       | Yes (release) | Yes    | Yes    |
| Static linking | Mostly        | Mostly | Mostly |
| RELRO          | Full          | Full   | Full   |
| PIE            | Yes           | Yes    | Yes    |
| Stack Canary   | Yes           | Yes    | Yes    |

---

## Exercises

### Ex 1.1 — ELF Header Analysis

```bash
# 1. Identifique o entry point do binario
readelf -h $(which bun) | grep "Entry"

Entry point address:               0x24c7e00

# 2. O que esse endereco significa?
# Dica: e relativo ao base address (PIE)
```

### Ex 1.2 — Section Mapping

```bash
# 1. Qual o tamanho total de codigo (.text)?
readelf -S $(which bun) | grep ".text"

[14] .text             PROGBITS         00000000024c7e00  02067e00

# 2. Qual a proporcao codigo vs dados?
size $(which bun)

   text    data     bss     dec     hex filename
92474809         215296 1885881 94575986        5a31d72 /home/rx/.bun/bin/bun
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
