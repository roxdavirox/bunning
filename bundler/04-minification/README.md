# Minification — Compressao e Ofuscacao de Codigo

> Como Bun minifica JavaScript e como reverter (ou explorar) esse processo.

---

## Intuition (Feynman)

Minificacao e como comprimir uma carta: remover espacos em branco, renomear variaveis para nomes curtos, eliminar comentarios. O codigo funciona igual mas e menor e mais dificil de ler.

Nao e seguranca por obscuridade — e economizar bytes. Mas desenvolvedores frequentemente confundem minificacao com protecao de codigo. Source maps podem reverter completamente o processo.

---

## Source Code

No repositorio `oven-sh/bun`:
```
src/
├── js_printer.zig       # Imprime AST minificado ou nao
├── renamer.zig          # Renomeia variaveis (minificacao de nomes)
└── ...
```

---

## Hands-On Analysis

### 1. Minificacao Basica

```bash
cat > /tmp/to-minify.ts << 'EOF'
// Funcao de utilidade com nomes descritivos
function calculateTotalPrice(
    productPrice: number,
    taxRate: number,
    discountPercentage: number
): number {
    const priceAfterDiscount = productPrice * (1 - discountPercentage / 100);
    const taxAmount = priceAfterDiscount * (taxRate / 100);
    return priceAfterDiscount + taxAmount;
}

export { calculateTotalPrice };
EOF

# Sem minificacao
echo "=== SEM MINIFICACAO ==="
bun build /tmp/to-minify.ts --target=node 2>/dev/null

# Com minificacao
echo ""
echo "=== COM MINIFICACAO ==="
bun build /tmp/to-minify.ts --target=node --minify 2>/dev/null
```

### 2. Opcoes de Minificacao

```bash
# Minificacao por partes
bun build input.ts \
    --minify-whitespace \   # remove espacos/newlines
    --minify-identifiers \  # renomeia variaveis para a, b, c...
    --minify-syntax \       # simplifica expressoes
    --outfile=output.js

# Equivalente:
bun build input.ts --minify --outfile=output.js
```

### 3. Reversao com Source Maps

```bash
# Minificar COM source map
bun build /tmp/to-minify.ts \
    --minify \
    --sourcemap=linked \
    --outfile=/tmp/minified.js

# Ver o bundle minificado
cat /tmp/minified.js

# O source map revela TODO o codigo original
cat /tmp/minified.js.map | python3 -m json.tool | grep -E "sources|sourceRoot"
```

---

## Security Analysis

### Source Maps em Producao = Codigo Fonte Exposto

```bash
# Muitos sites em producao expoe source maps acidentalmente

# Verificar se um site expoe source maps
curl -s "https://example.com/static/js/main.chunk.js" | \
    grep "# sourceMappingURL" | tail -1

# Se houver, baixar o source map e extrair codigo original
# (usando ferramentas como source-map-explorer)

# Para aplicacoes Bun:
curl -s "https://app.example.com/bundle.js" | tail -1 | \
    grep -o "sourceMappingURL=.*" | sed 's/sourceMappingURL=//'
```

### Strings em Bundles Minificados

```bash
# Mesmo minificado, strings nao sao ofuscadas por padrao
cat > /tmp/sensitive.ts << 'EOF'
const INTERNAL_API = "https://internal-api.company.com/v2";
const DB_PASSWORD = "super-secret-pass-123";
const JWT_SECRET = "my-jwt-signing-key";

export function connect() {
    return fetch(INTERNAL_API, {
        headers: { Authorization: `Bearer ${JWT_SECRET}` }
    });
}
EOF

bun build /tmp/sensitive.ts --minify --outfile=/tmp/sensitive-min.js 2>/dev/null
echo "Strings no bundle minificado:"
strings /tmp/sensitive-min.js | grep -E "internal-api|secret|jwt"
```

### Bundle Size Analysis

```bash
# Analisar o que ocupa espaco no bundle
bun build ./src/index.ts --metafile=/tmp/meta.json --outfile=/tmp/bundle.js

# Ver tamanhos por modulo
cat /tmp/meta.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
inputs = data.get('inputs', {})
sorted_inputs = sorted(inputs.items(), key=lambda x: x[1].get('bytes', 0), reverse=True)
for path, info in sorted_inputs[:20]:
    print(f\"{info.get('bytes', 0):>10} bytes: {path}\")
"
```

---

## Exercises

### Ex B4.1 — Reversao de Minificacao

```bash
# Desobfuscar codigo minificado manualmente
cat > /tmp/obfuscated.js << 'EOF'
function a(b,c,d){const e=b*(1-d/100);const f=e*(c/100);return e+f}module.exports={a};
EOF

# Usar prettier para reformatar
if command -v prettier &>/dev/null; then
    prettier /tmp/obfuscated.js
elif command -v bun &>/dev/null; then
    # Bun pode reformatar com sua API de transpiler
    bun -e "
const source = require('fs').readFileSync('/tmp/obfuscated.js', 'utf-8');
// Analise manual dos nomes
console.log(source.replace(/\b([a-z])\b(?=\s*[=,(])/g, (m) => ({
    a: 'calculate', b: 'price', c: 'tax', d: 'discount', e: 'afterDiscount', f: 'taxAmount'
}[m] ?? m)));
"
fi
```

### Ex B4.2 — Source Map Extraction

```bash
# Extrair codigo original de um source map
cat > /tmp/extract_sourcemap.ts << 'EOF'
// Exemplo: extrair fontes de um source map
const sourceMapBase64 = await Bun.file("/tmp/minified.js.map").json();

console.log("Arquivos fontes incluidos:");
sourceMapBase64.sources?.forEach((src: string) => console.log(" -", src));

console.log("\nConteudo do primeiro arquivo fonte:");
if (sourceMapBase64.sourcesContent?.[0]) {
    console.log(sourceMapBase64.sourcesContent[0].slice(0, 500));
}
EOF
bun /tmp/extract_sourcemap.ts 2>/dev/null || echo "Gere primeiro o source map com o Ex anterior"
```

### Ex B4.3 — Secret Scanner em Bundle

```bash
# Varredura de secrets em bundle (produção)
cat > /tmp/scan_bundle_secrets.sh << 'EOF'
#!/bin/bash
BUNDLE=$1
[ -z "$BUNDLE" ] && BUNDLE="/tmp/bundle.js"

echo "=== Secret Scanner: $BUNDLE ==="

# Patterns de secrets comuns
declare -A patterns=(
    ["AWS Access Key"]="AKIA[0-9A-Z]{16}"
    ["AWS Secret"]="[0-9a-zA-Z/+]{40}"
    ["JWT Token"]="eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}"
    ["Generic API Key"]="(api[_-]?key|apikey)\s*[=:]\s*['\"][^'\"]{8,}['\"]"
    ["URL com credencial"]="https?://[^:@]+:[^@]+@[a-zA-Z0-9.-]+"
)

for name in "${!patterns[@]}"; do
    results=$(grep -oE "${patterns[$name]}" "$BUNDLE" 2>/dev/null | head -3)
    if [ -n "$results" ]; then
        echo "[ENCONTRADO] $name:"
        echo "$results" | while read line; do echo "  $line"; done
    fi
done
EOF
chmod +x /tmp/scan_bundle_secrets.sh
bash /tmp/scan_bundle_secrets.sh /tmp/sensitive-min.js
```

---

## Checkpoint

[ ] Minificou codigo com `bun build --minify`
[ ] Verificou que strings nao sao ofuscadas pela minificacao
[ ] Extraiu codigo fonte de um source map
[ ] Entende que `--sourcemap=linked` expoe codigo original
[ ] Executou secret scanner em bundle minificado

---

## Next

→ [`../package/01-registry`](../../package/01-registry/) — sistema de pacotes do Bun
