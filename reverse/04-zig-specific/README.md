# Zig-Specific RE — Tecnicas para Binarios Zig

> Como reverter engenharia em binarios Zig: naming conventions, panic handlers, e comptime.

---

## Intuition (Feynman)

Zig deixa marcas caracteristicas em binarios que diferenciam de C/C++/Rust. Conhecer essas marcas facilita a analise: onde o codigo Zig começa, onde termina, como o Zig chama C, e onde o JSC começa.

Para o Bun especificamente: o binario e um hibrido — Zig no exterior, C++ (JSC) no interior, e JavaScript sendo interpretado em runtime. Cada camada tem assinaturas diferentes.

---

## Source Code

```
# Ferramentas especificas:
# radare2 com Zig support
# Ghidra (melhor suporte a Zig em versoes recentes)
# objdump -d (disassembly)
# strings -a (extrair todas as strings)
```

---

## Hands-On Analysis

### 1. Fingerprints de Binarios Zig

```bash
BUN=$(which bun)

echo "=== Zig Fingerprints ==="

# 1. Panic messages (tipicas do Zig)
echo "--- Panic strings ---"
strings $BUN | grep -E "panic|unreachable|integer overflow|index out of bounds" | \
    grep -v "javascript\|js\|error" | head -10

# 2. Nomes de arquivos Zig em strings (em builds debug)
echo ""
echo "--- Source files Zig ---"
strings $BUN | grep -E "\.zig:[0-9]+" | head -10

# 3. Build metadata
echo ""
echo "--- Build metadata ---"
strings $BUN | grep -iE "zig [0-9]|zig-[0-9]" | head -5

# 4. Funcoes alocadoras tipicas do Zig
echo ""
echo "--- Allocator patterns ---"
nm -D $BUN 2>/dev/null | grep -iE "alloc|gpa|arena" | head -10
```

### 2. Call Conventions Zig

```bash
# Zig usa System V AMD64 ABI no Linux (igual a C)
# Mas tem convencoes de nome diferentes

# Ver funcoes exportadas do Bun
nm -D $(which bun) 2>/dev/null | grep -v "U " | head -20

# Zig mangled names (diferente de C++ mas tem padrao)
# Formato tipico: funcao_zig_modulo_nome
strings $(which bun) | grep -E "_zig_[a-z]+" | head -10

# Funcoes de panic do Zig
nm -D $(which bun) 2>/dev/null | grep -i "panic" | head -10
```

### 3. Inspecionar JSC dentro do Bun

```bash
BUN=$(which bun)

echo "=== JSC/WebKit dentro do Bun ==="

# Strings tipicas do WebKit/JSC
strings $BUN | grep -iE "webkit|javascriptcore" | sort -u | head -5

# Excecoes JSC
strings $BUN | grep -E "JSException|JSC::" | head -10

# Versoes do JavaScript
strings $BUN | grep -iE "es20[0-9][0-9]|ecmascript" | head -5

# Opcodes do bytecode JSC
strings $BUN | grep -iE "bytecode|opcode|LLInt" | head -5
```

### 4. Disassembly de Funcoes Especificas

```bash
BUN=$(which bun)

# Encontrar funcoes interessantes para desassemblar
if command -v objdump &>/dev/null; then
    echo "=== Funcoes do Bun (primeiras 10) ==="
    # Listar funcoes (apenas em builds com simbolos)
    objdump -d $BUN 2>/dev/null | \
        grep "<[a-zA-Z_][a-zA-Z0-9_]*>:" | \
        grep -v "@plt" | \
        head -10

    echo ""
    echo "=== Disassembly do entry point ==="
    ENTRY=$(readelf -h $BUN | grep "Entry point" | awk '{print $4}')
    objdump -d --start-address=$ENTRY --stop-address=$((ENTRY + 0x100)) \
        $BUN 2>/dev/null | head -30
fi
```

---

## Security Analysis

### Panic Handler como Oracle

```bash
# Zig em ReleaseSafe ainda tem panic handlers
# Causar um panic revela informacao sobre internals

# Tipos de panics que o Bun pode ter:
# - Tentativa de alocar memoria insuficiente
# - Integer overflow em ReleaseSafe
# - Index out of bounds

# Trigger de panic via script JS
cat > /tmp/panic_trigger.js << 'EOF'
// Tentar causar panic no runtime Bun via:
// 1. Alocacao extrema
try {
    const buf = new ArrayBuffer(Number.MAX_SAFE_INTEGER);
} catch(e) {
    console.log("Alocacao extrema:", e.message);
}

// 2. String extremamente longa
try {
    const s = "x".repeat(2**30);
} catch(e) {
    console.log("String extrema:", e.message);
}

// 3. Recursao extrema
try {
    function deep() { return deep(); }
    deep();
} catch(e) {
    console.log("Stack overflow:", e.message);
}
EOF

timeout 10 bun /tmp/panic_trigger.js 2>&1
```

### Comptime Info Leakage

```bash
# Informacoes compiladas em tempo de compile-time (comptime) ficam no binario
# como constantes em .rodata

# Ver constantes que parecem ser calculadas em compile-time
strings $(which bun) | grep -E "^[0-9]{10,}$" | sort -n | tail -10
# Grandes numeros podem ser tamanhos de buffer, magics, etc

# SHA/hash de builds (para verificacao de integridade)
strings $(which bun) | grep -E "^[0-9a-f]{40}$" | head -5 # SHA1
strings $(which bun) | grep -E "^[0-9a-f]{64}$" | head -5 # SHA256
```

---

## Exercises

### Ex R4.1 — Zig vs C Binary Diff

```bash
# Comparar fingerprints de binario Zig vs C
cat > /tmp/compare_zig_c.sh << 'EOF'
#!/bin/bash

# Criar binario C simples
cat > /tmp/simple.c << 'CSRC'
#include <stdio.h>
int main() { printf("hello\n"); return 0; }
CSRC
gcc -O2 -o /tmp/simple_c /tmp/simple.c

# Criar binario Zig simples  
cat > /tmp/simple.zig << 'ZIGSRC'
const std = @import("std");
pub fn main() !void {
    try std.io.getStdOut().writeAll("hello\n");
}
ZIGSRC
zig build-exe /tmp/simple.zig -O ReleaseFast -o /tmp/simple_zig 2>/dev/null || \
    echo "Zig nao disponivel"

echo "=== Comparacao de fingerprints ==="

for bin in /tmp/simple_c /tmp/simple_zig $(which bun); do
    [ -f "$bin" ] || continue
    name=$(basename $bin)
    size=$(stat -c%s $bin 2>/dev/null)
    panic=$(strings $bin | grep -c "panic\|unreachable")
    zig_files=$(strings $bin | grep -c "\.zig:")

    echo ""
    echo "[$name] tamanho=$size panic_strings=$panic zig_files=$zig_files"
done
EOF
bash /tmp/compare_zig_c.sh
```

### Ex R4.2 — JSC vs Zig Boundary

```bash
# Identificar a fronteira entre codigo Zig e codigo JSC (C++) no binario
BUN=$(which bun)

echo "=== JSC (C++) markers ==="
strings $BUN | grep -E "::[A-Z][a-zA-Z]+" | sort -u | head -15
# C++ mangled names tem :: para namespaces

echo ""
echo "=== Zig markers ==="
strings $BUN | grep -E "^[a-z][a-z_]+\.[a-z][a-z_]+" | head -15
# Zig usa snake_case e namespace.funcao

echo ""
echo "=== Interface C (sem mangling) ==="
nm -D $BUN 2>/dev/null | grep " T " | \
    grep -v "__\|@\|+\|::" | \
    awk '{print $3}' | head -15
```

### Ex R4.3 — Build Info Extraction

```bash
# Extrair informacoes de build do binario Bun
BUN=$(which bun)

echo "=== Informacoes de Build ==="

# Versao do Bun
echo "Bun version: $(bun --version)"

# Versao do compilador Zig usado para construir
ZIGVER=$(strings $BUN | grep -iE "zig [0-9]\.[0-9]" | head -1)
echo "Zig version: ${ZIGVER:-nao detectado}"

# Build target
ARCH=$(readelf -h $BUN | grep Machine | awk '{print $NF}')
echo "Arquitetura: $ARCH"

# Build date (se presente)
BUILDDATE=$(strings $BUN | grep -iE "built|compiled" | head -2)
echo "Build date: ${BUILDDATE:-nao detectado}"

# LLVM version (Zig usa LLVM como backend)
LLVMVER=$(strings $BUN | grep -iE "LLVM [0-9]" | head -1)
echo "LLVM version: ${LLVMVER:-nao detectado}"

# Git hash (se presente no binario)
GITHASH=$(strings $BUN | grep -E "^[0-9a-f]{40}$" | head -1)
echo "Git hash: ${GITHASH:-nao detectado}"
```

---

## Checkpoint

[ ] Identificou strings de panic tipicas do Zig no Bun
[ ] Distinguiu codigo Zig vs C++ (JSC) via strings
[ ] Extraiu informacoes de build (versao, arquitetura)
[ ] Entende como comptime deixa constantes no binario
[ ] Sabe que o Bun e um hibrido Zig + C++ (JSC)

---

## Conclusao do Modulo Reverse

Voce completou o modulo de engenharia reversa do Bun. Agora sabe:
- Analisar o binario estaticamente (readelf, strings, nm)
- Tracar execucao dinamica (strace, LD_PRELOAD)
- Instrumentar via hooks (LD_PRELOAD, Frida)
- Identificar codigo Zig vs JSC no binario

→ Retornar ao inicio: [`../runtime/01-binary-layout`](../../runtime/01-binary-layout/)
→ Ou avancar para exercicios praticos: [`../../exercises/`](../../exercises/)
