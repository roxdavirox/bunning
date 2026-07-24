# Static Analysis — Analise Estatica do Binario Bun

> Usando readelf, objdump, Ghidra, e strings para entender o binario sem executar.

---

## Intuition (Feynman)

Analise estatica e como estudar um livro sem ler: voce examina o indice (headers), os capitulos (sections), as referencias bibliograficas (imports/exports), e as ilustracoes (strings/constantes) para entender o que o livro e sobre — antes de ler uma palavra.

Para o Bun: podemos aprender muito sobre sua estrutura interna, versoes de bibliotecas, e potenciais vulnerabilidades sem executar uma linha do binario.

---

## Source Code

```
# Ferramentas:
# readelf - leitura de ELF headers e sections
# objdump - disassembly e dump de sections
# strings - extrair strings do binario
# nm      - listar simbolos
# file    - identificar tipo de arquivo
# checksec - verificar features de seguranca
# Ghidra  - decompilador (NSA)
# radare2 - framework de RE
# Binary Ninja, IDA Pro (comerciais)
```

---

## Hands-On Analysis

### 1. Reconhecimento Inicial

```bash
BUN=$(which bun)
echo "=== Identificacao ==="
file $BUN

echo ""
echo "=== Tamanho ==="
ls -lh $BUN
size $BUN  # texto, data, bss

echo ""
echo "=== Tipo ELF ==="
readelf -h $BUN | grep -E "Class|Type|Machine|Entry|Flags"
```

### 2. Analise de Sections

```bash
BUN=$(which bun)

echo "=== Sections ==="
readelf -S $BUN | grep -E "\.(text|data|rodata|bss|plt|got|note)" | \
    awk '{printf "%-20s size=%s flags=%s\n", $2, $7, $9}'

echo ""
echo "=== Segmentos de Carregamento ==="
readelf -l $BUN | grep -A1 "LOAD\|GNU_STACK\|GNU_RELRO"
```

### 3. Analise de Simbolos

```bash
BUN=$(which bun)

echo "=== Simbolos Dinamicos (exported) ==="
nm -D $BUN 2>/dev/null | grep -v "U " | head -20

echo ""
echo "=== Simbolos Importados (needed) ==="
nm -D $BUN 2>/dev/null | grep " U " | head -20

echo ""
echo "=== Bibliotecas Dinamicas ==="
ldd $BUN

echo ""
echo "=== Interpretador ==="
readelf -l $BUN | grep "interpreter"
```

### 4. Strings de Interesse

```bash
BUN=$(which bun)

echo "=== Versoes de Componentes ==="
strings $BUN | grep -iE "version|v[0-9]+\.[0-9]+" | \
    grep -v "^[0-9]" | sort -u | head -20

echo ""
echo "=== URLs ==="
strings $BUN | grep -E "https?://[a-zA-Z0-9.]+" | \
    sort -u | head -20

echo ""
echo "=== Mensagens de Erro ==="
strings $BUN | grep -iE "panic|assert|unreachable|fatal" | \
    sort -u | head -20

echo ""
echo "=== Caminhos de Arquivo ==="
strings $BUN | grep -E "^(/[a-z]+){2,}" | sort -u | head -10
```

---

## Security Analysis

### Feature Detection

```bash
BUN=$(which bun)

echo "=== Security Features (manual) ==="

# PIE
if readelf -h $BUN | grep -q "DYN (Shared object file)"; then
    echo "[OK] PIE: habilitado"
else
    echo "[FAIL] PIE: desabilitado"
fi

# NX
nx=$(readelf -l $BUN | grep "GNU_STACK" | awk '{print $NF}')
if [ "$nx" = "RW" ]; then
    echo "[OK] NX: stack nao-executavel"
else
    echo "[FAIL] NX: stack executavel ($nx)"
fi

# Full RELRO
if readelf -l $BUN | grep -q "GNU_RELRO"; then
    echo "[OK] RELRO: presente"
    if readelf -d $BUN | grep -q "BIND_NOW"; then
        echo "[OK] Full RELRO: BIND_NOW presente"
    else
        echo "[PARTIAL] Partial RELRO: BIND_NOW ausente"
    fi
fi

# Stack canary
if nm -D $BUN 2>/dev/null | grep -q "__stack_chk"; then
    echo "[OK] Stack Canary: presente"
else
    echo "[WARN] Stack Canary: nao detectado"
fi
```

### Ghidra Analysis

```bash
# Instalar e usar Ghidra para decompilacao
# https://ghidra-sre.org/

# Se disponivel:
if command -v ghidra &>/dev/null; then
    echo "Ghidra disponivel"
    # Modo headless para analise automatizada:
    # ghidra_headless /tmp/bun-project BunAnalysis \
    #     -import $(which bun) \
    #     -postScript PrintASM.java > /tmp/bun_asm.txt
else
    echo "Ghidra nao disponivel"
    echo "Download: https://ghidra-sre.org/"
    echo "Alternativa: radare2"
fi

# radare2 (se disponivel):
if command -v r2 &>/dev/null; then
    echo ""
    echo "=== radare2 quick analysis ==="
    r2 -q -c 'aaa; afl~main' $(which bun) 2>/dev/null | head -10
fi
```

---

## Exercises

### Ex R1.1 — ELF Deep Dive

```bash
# Analise completa do ELF do Bun
cat > /tmp/elf_analysis.sh << 'EOF'
#!/bin/bash
BUN=$(which bun)
echo "=== ELF Analysis: $BUN ==="

# Tamanho de cada section
echo ""
echo "--- Sections (por tamanho) ---"
readelf -S $BUN | awk '
/\[/{
    name=$2;
    size="0x"$7
    printf "%s %s\n", name, size
}' | sort -k2 -rn 2>/dev/null | head -15

# Numero de funcoes exportadas
echo ""
echo "--- Funcoes exportadas ---"
nm -D $BUN 2>/dev/null | grep -c " T " | xargs echo "Total:"

# Imports de biblioteca
echo ""
echo "--- Bibliotecas necessarias ---"
readelf -d $BUN | grep "NEEDED" | sed 's/.*\[//' | sed 's/\]//'

# Informacoes de build
echo ""
echo "--- Build info ---"
readelf -n $BUN 2>/dev/null | grep -A3 "Build ID" | head -5
strings $BUN | grep -iE "build date|compiled|version" | head -5
EOF
bash /tmp/elf_analysis.sh
```

### Ex R1.2 — Comparacao de Binarios

```bash
# Comparar dois builds do Bun (ou Bun vs Node)
cat > /tmp/compare_bins.sh << 'EOF'
#!/bin/bash
BIN1=${1:-$(which bun)}
BIN2=${2:-$(which node)}

echo "=== Comparando: $(basename $BIN1) vs $(basename $BIN2) ==="

for bin in "$BIN1" "$BIN2"; do
    name=$(basename $bin)
    size=$(stat -c%s $bin 2>/dev/null)
    stripped=$(file $bin | grep -c "stripped")
    relro=$(readelf -l $bin 2>/dev/null | grep -c "GNU_RELRO")
    pie=$(readelf -h $bin 2>/dev/null | grep -c "DYN")
    nx=$(readelf -l $bin 2>/dev/null | grep "GNU_STACK" | grep -c "RW")

    echo ""
    echo "[$name]"
    echo "  Tamanho: $(numfmt --to=iec $size)"
    echo "  Stripped: $([ $stripped -gt 0 ] && echo 'sim' || echo 'nao')"
    echo "  PIE: $([ $pie -gt 0 ] && echo 'sim' || echo 'nao')"
    echo "  RELRO: $([ $relro -gt 0 ] && echo 'sim' || echo 'nao')"
    echo "  NX: $([ $nx -gt 0 ] && echo 'sim' || echo 'nao')"
done
EOF
bash /tmp/compare_bins.sh
```

### Ex R1.3 — String Hunting

```bash
# Busca sistematica de informacoes uteis
cat > /tmp/string_hunt.sh << 'EOF'
#!/bin/bash
BUN=$(which bun)

echo "=== String Hunter: $BUN ==="

echo ""
echo "--- Versoes de dependencias ---"
strings $BUN | grep -E "^[0-9]+\.[0-9]+\.[0-9]" | sort -u | head -10
strings $BUN | grep -E "BoringSSL|libuv|uwebsocket|jsc|webkit" | \
    grep -iE "version|v[0-9]" | sort -u | head -10

echo ""
echo "--- Chaves/tokens hardcoded? ---"
strings $BUN | grep -E "^[A-Za-z0-9+/]{40,}$" | \
    grep -v "^[A-Za-z]{40,}$" | head -5

echo ""
echo "--- Funcoes Zig (com path de arquivo) ---"
strings $BUN | grep -E "\.zig:[0-9]+" | sort -u | head -15

echo ""
echo "--- Caminhos de desenvolvimento ---"
strings $BUN | grep -E "/home/|/Users/|/workspace/" | sort -u | head -5
EOF
bash /tmp/string_hunt.sh
```

---

## Checkpoint

[ ] Identificou tipo e arquitetura do binario com `file` e `readelf -h`
[ ] Listou todas as sections com tamanhos
[ ] Extraiu strings de versao de componentes internos
[ ] Verificou features de seguranca manualmente
[ ] Comparou binario do Bun com Node.js

---

## Next

→ [`02-dynamic`](../02-dynamic/) — analise dinamica e tracing
