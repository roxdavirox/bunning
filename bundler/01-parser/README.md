# Parser — Como Bun Analisa JavaScript e TypeScript

> O parser JS/TS do Bun: arquitetura, AST, e como explorar ambiguidades.

---

## Intuition (Feynman)

Um parser e como um gramatico que le codigo e descobre sua estrutura. `1 + 2 * 3` nao e `(1 + 2) * 3` — o parser conhece precedencia de operadores e constroi uma arvore de dependencias (AST) que representa a estrutura correta.

O Bun tem um parser proprio escrito em Zig, mais rapido que os parsers JS do Node.js. Isso importa para seguranca: bugs de parsing podem causar comportamentos diferentes entre o que o desenvolvedor espera e o que o runtime executa.

---

## Source Code

No repositorio `oven-sh/bun`:
```
src/
├── js_parser.zig        # Parser principal (arquivo enorme)
├── js_lexer.zig         # Lexer (tokenizer)
├── js_ast.zig           # Definicoes do AST
└── js_printer.zig       # AST → codigo (para bundler)
```

---

## Hands-On Analysis

### 1. Como o Parser Funciona

```
Codigo fonte → [Lexer] → Tokens → [Parser] → AST → [Bundler] → Output
                                              ↓
                                         [Type checker] (TypeScript)
```

```bash
# Bun transforma TypeScript em tempo real, sem tsc
cat > /tmp/test.ts << 'EOF'
interface User {
    id: number;
    name: string;
}

function greet(user: User): string {
    return `Hello, ${user.name}!`;
}

console.log(greet({ id: 1, name: "World" }));
EOF

# Bun executa TS diretamente (sem compilacao separada)
bun /tmp/test.ts
```

### 2. Inspecionar Output do Parser

```bash
# Bun pode imprimir o bundle gerado (que mostra como parseia)
cat > /tmp/parse_demo.ts << 'EOF'
const x = 1 + 2 * 3;
const fn = (a: number, b: number) => a + b;
export { x, fn };
EOF

# Ver o que o bundler gera
bun build /tmp/parse_demo.ts --target=node 2>/dev/null
```

### 3. Edge Cases de Parsing

```javascript
// Ambiguidades JS que o parser deve resolver

// 1. Arrow function vs comparacao
const a = x => x + 1;           // arrow function
const b = (x) > (y);            // comparacao

// 2. Destructuring vs objeto
const { x } = obj;              // destructuring
const y = { x: 1 };            // objeto

// 3. Yield em generator
function* gen() {
    const x = yield 1;          // yield expression
}

// 4. RegExp vs divisao
const re = /abc/g;
const div = a / b / c;          // dois operadores de divisao
```

---

## Security Analysis

### Diferencias entre Parsers

```javascript
// Bun (JSC) vs Node (V8) podem ter comportamentos diferentes
// em casos extremos

// Teste: codigo valido em um mas invalido em outro?
const tests = [
    // String com escape unicode
    "A",                     // "A"

    // Template literal com nested
    `${`nested`}`,

    // Regex com look-behind
    /(?<=foo)bar/.test("foobar"),

    // Optional chaining em assignments (invalido)
    // a?.b = 1;                  // SyntaxError
];

tests.forEach((t, i) => {
    try {
        eval(`const _test = ${typeof t === "string" ? JSON.stringify(t) : t}`);
        console.log(`Test ${i}: OK`);
    } catch (e) {
        console.log(`Test ${i}: ERROR - ${e.message}`);
    }
});
```

### Source Map Confusion

```bash
# Source maps mapeiam codigo minificado de volta ao original
# Podem revelar estrutura interna ou causar confusao de parsing

cat > /tmp/with_sourcemap.ts << 'EOF'
// @ts-check
const secret = "nao_aparece_no_bundle";
export const safe = "aparece";
EOF

# Bundle com source map
bun build /tmp/with_sourcemap.ts --sourcemap=inline 2>/dev/null

# A string "secret" aparece no source map!
bun build /tmp/with_sourcemap.ts --sourcemap=inline 2>/dev/null | grep -o '"mappings".*' | head -c 100
```

---

## Exercises

### Ex B1.1 — Syntax Error Detection

```typescript
// Descubra o que Bun aceita vs rejeita
const snippets = [
    "const x = 1;",
    "const x = ;",                    // erro
    "import x from 'y' assert {}",    // import assertions
    "const x = a ?? b ?? c;",         // nullish chaining
    "const x = a?.b?.c?.();",         // optional chaining
    "const #x = 1;",                  // private fora de classe (erro)
];

for (const code of snippets) {
    try {
        new Function(code);
        console.log(`OK: ${code.slice(0, 40)}`);
    } catch (e) {
        console.log(`ERR: ${code.slice(0, 40)} → ${e.message}`);
    }
}
```

### Ex B1.2 — TypeScript Strip

```typescript
// Verificar que Bun remove tipos TypeScript sem erros
const typedCode = `
interface Foo { x: number }
type Bar = string | number;
function test<T extends Foo>(arg: T): T { return arg; }
const val: Foo = { x: 1 };
console.log(val.x);
`;

// Bun converte TS → JS removendo tipos
// Verificar que o output e JS valido
import { transpileSync } from "bun";
const result = Bun.transpiler.transformSync(typedCode, "ts");
console.log("TypeScript → JavaScript:");
console.log(result);
```

### Ex B1.3 — Macro e Comptime JS

```typescript
// Bun tem "macros" — codigo que roda em build time
// Arquivo: macro.ts
export function buildTimeInfo() {
    return {
        buildAt: new Date().toISOString(),
        bunVersion: Bun.version,
    };
}

// Uso com import "macro":
// import { buildTimeInfo } from "./macro.ts" with { type: "macro" };
// const info = buildTimeInfo(); // executado em BUILD TIME, nao runtime

// Implicacao de seguranca: macros tem acesso ao filesystem em build time
```

---

## Checkpoint

[ ] Entende o pipeline: fonte → lexer → AST → output
[ ] Bun transpila TypeScript sem tsc
[ ] Identificou edge cases de parsing JS
[ ] Entende que source maps podem revelar codigo original
[ ] Sabe o que sao macros Bun e suas implicacoes

---

## Next

→ [`02-ast`](../02-ast/) — estrutura da AST e transformacoes
