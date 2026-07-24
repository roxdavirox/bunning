# Tree Shaking — Eliminacao de Codigo Morto

> Como Bun remove codigo nao-utilizado e as implicacoes para analise de seguranca.

---

## Intuition (Feynman)

Tree shaking e como podar uma arvore morta: o bundler analisa quais exportacoes de um modulo sao realmente usadas e remove as que nao sao. Se voce importa `{ useState }` do React, o bundler nao precisa incluir `useEffect`, `useMemo`, etc no bundle final.

Para seguranca: tree shaking pode remover codigo de logging, debugging, ou auditoria que voce achava que ia para producao. E codigo aparentemente morto pode nao ser removido se houver side effects.

---

## Source Code

No repositorio `oven-sh/bun`:
```
src/
├── js_parser.zig        # Marca exports como usados/nao-usados
├── linker.zig           # Decide o que incluir no bundle
└── js_printer.zig       # Omite nos nao-usados da AST
```

---

## Hands-On Analysis

### 1. Tree Shaking Basico

```typescript
// lib.ts — biblioteca com multiplas exportacoes
export function used() {
    console.log("Eu sou usado!");
}

export function unused() {
    console.log("Eu deveria ser removido");
    // dados sensiveis que parecem "mortos"
    const INTERNAL_SECRET = "valor_que_nao_deveria_estar_no_bundle";
}

export const SECRET_KEY = "chave_que_parece_nao_usada";
```

```typescript
// main.ts — importa apenas "used"
import { used } from "./lib";
used();
```

```bash
# Bundlar e verificar o que esta no output
bun build main.ts --target=node 2>/dev/null | grep -E "unused|SECRET"
# Se tree shaking funcionar: "unused" e "SECRET_KEY" nao aparecem
```

### 2. Side Effects Impedem Tree Shaking

```typescript
// lib-with-side-effects.ts
export function pure() {
    return 42; // sem side effects — pode ser removida
}

// Side effect no nivel do modulo — IMPEDE tree shaking de todo o modulo
console.log("Este log acontece quando o modulo e importado");
document.title = "Side effect!";
fetch("https://analytics.example.com/load"); // chamada no import!
```

```json
// package.json — indicar que o modulo NAO tem side effects
{
  "name": "my-lib",
  "sideEffects": false
}

// Ou especificar quais arquivos tem side effects:
{
  "sideEffects": ["./src/polyfills.js", "*.css"]
}
```

### 3. Verificar o que Foi Incluido

```bash
# Construir bundle e analisar conteudo
bun build ./src/index.ts --outfile=/tmp/bundle.js

# Ver tamanho e conteudo
wc -c /tmp/bundle.js
strings /tmp/bundle.js | grep -iE "secret|password|internal|debug"

# Verificar com sourcemaps
bun build ./src/index.ts --outfile=/tmp/bundle.js --sourcemap=linked
# Abrir /tmp/bundle.js.map para ver todos os arquivos incluidos
```

---

## Security Analysis

### Dados Sensiveis em Codigo "Morto"

```typescript
// PROBLEMA REAL: desenvolvedor assume que codigo morto nao vai para producao
export const DEV_CREDENTIALS = {
    apiKey: "dev-key-12345",
    secret: "dev-secret",
};

export const PROD_CONFIG = {
    apiUrl: "https://api.example.com",
};

// Se DEV_CREDENTIALS nunca e importado, tree shaking remove
// MAS se houver algum import indireto, vai para o bundle!
```

```bash
# VERIFICAR: buscar por strings sensiveis no bundle
bun build ./src --outdir=/tmp/prod-build

# Varredura de seguranca no bundle
grep -rE "(key|secret|password|token|credential)" /tmp/prod-build/ | \
    grep -v "//.*" | head -20
```

### Tree Shaking Unreliable Cases

```typescript
// Casos onde tree shaking FALHA em remover codigo

// 1. Spreads dinamicos
import * as lib from "./lib"; // importa TUDO
const { used } = lib;         // mas usa so "used"
// tree shaker nao pode saber o que mais pode ser acessado

// 2. Computed property access
const key = getKeyAtRuntime();
const result = lib[key]();    // impossivel analizar estaticamente

// 3. Re-exports confusos
export { everything } from "./everything"; // inclui tudo

// 4. CommonJS (nao ES modules)
const { used } = require("./lib"); // CJS nao permite tree shaking
```

---

## Exercises

### Ex B3.1 — Bundle Analysis

```bash
# Construir um projeto e analisar o que foi incluido
mkdir -p /tmp/tree-shake-lab

cat > /tmp/tree-shake-lab/utils.ts << 'EOF'
export function formatDate(d: Date) { return d.toISOString(); }
export function formatMoney(n: number) { return `$${n.toFixed(2)}`; }
export function debugHelper() {
    const INTERNAL_URL = "http://internal.example.com/debug";
    return fetch(INTERNAL_URL);
}
EOF

cat > /tmp/tree-shake-lab/main.ts << 'EOF'
import { formatDate } from "./utils";
console.log(formatDate(new Date()));
EOF

cd /tmp/tree-shake-lab
bun build ./main.ts --outfile=bundle.js --target=node

echo "=== Conteudo do bundle ==="
cat bundle.js

echo ""
echo "=== Strings potencialmente sensiveis ==="
grep -iE "internal|debug|INTERNAL_URL" bundle.js || echo "Nenhuma string suspeita encontrada"
```

### Ex B3.2 — Side Effect Test

```typescript
// Teste quais side effects impedem tree shaking
const tests = [
    { name: "sem side effect", code: "export const x = 1;" },
    { name: "console.log", code: "console.log('log'); export const x = 1;" },
    { name: "fetch", code: "fetch('/ping'); export const x = 1;" },
    { name: "modificar global", code: "globalThis.x = 1; export const y = 2;" },
];

for (const test of tests) {
    const path = `/tmp/side-effect-${test.name.replace(/\s/g, "-")}.ts`;
    await Bun.write(path, test.code);

    // Criar main que importa mas nao usa
    const mainPath = `/tmp/main-${test.name.replace(/\s/g, "-")}.ts`;
    await Bun.write(mainPath, `import "${path}";`);

    const result = await Bun.build({ entrypoints: [mainPath] });
    const output = await result.outputs[0].text();
    const size = output.length;

    console.log(`${test.name}: ${size} bytes`);
}
```

### Ex B3.3 — Security Bundle Scan

```bash
# Script completo de auditoria de bundle
cat > /tmp/bundle_security_scan.sh << 'EOF'
#!/bin/bash
BUNDLE=$1
[ -z "$BUNDLE" ] && echo "Uso: $0 <bundle.js>" && exit 1

echo "=== Auditoria de Seguranca: $BUNDLE ==="
echo ""

echo "--- Possíveis secrets ---"
grep -nE "(api[_-]?key|secret[_-]?key|password|token)\s*[=:]\s*['\"][^'\"]{8,}" \
    "$BUNDLE" 2>/dev/null | head -10 || echo "Nenhum encontrado"

echo ""
echo "--- URLs hardcoded ---"
grep -oE "https?://[a-zA-Z0-9.-]+(/[a-zA-Z0-9._/-]*)?" "$BUNDLE" | \
    grep -v "^https://example\|schemas\|protocols" | \
    sort -u | head -10

echo ""
echo "--- Codigo perigoso ---"
grep -nE "eval\(|new Function\(|innerHTML\s*=" "$BUNDLE" | head -10 || echo "Nenhum encontrado"
EOF
chmod +x /tmp/bundle_security_scan.sh
```

---

## Checkpoint

[ ] Demonstrou tree shaking removendo exportacao nao-usada
[ ] Identificou side effects que impedem tree shaking
[ ] Escaneou bundle em busca de strings sensiveis
[ ] Entende por que `import *` impede tree shaking
[ ] Sabe como `sideEffects: false` em package.json ajuda

---

## Next

→ [`04-minification`](../04-minification/) — minificacao e ofuscacao
