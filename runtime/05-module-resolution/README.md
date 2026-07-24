# Module Resolution — Como Bun Resolve Imports

> Algoritmo de resolucao, node_modules, ESM/CJS interop, e ataques de path traversal.

---

## Intuition (Feynman)

Quando voce escreve `import foo from "bar"`, o Bun precisa descobrir qual arquivo carregar. Isso parece simples mas e surpreendentemente complexo: pode ser um arquivo local (`./bar.js`), um pacote (`node_modules/bar`), uma URL, ou um builtin (`bun:ffi`).

O processo e como procurar um livro em uma biblioteca: primeiro checa se tem na sua mesa (cache), depois no andar atual (diretorio local), depois em andares acima (node_modules pai), ate chegar na recepcao (raiz do projeto).

---

## Source Code

No repositorio `oven-sh/bun`:
```
src/
├── resolver/
│   ├── resolver.zig       # Algoritmo principal
│   ├── package_json.zig   # Parsing de package.json
│   └── tsconfig.zig       # TypeScript paths
├── module_loader.zig      # Carregamento de modulos
└── bundler/               # Bundler (resolve em build time)
```

---

## Hands-On Analysis

### 1. Algoritmo de Resolucao

```javascript
// Ordem de resolucao para: import "foo"
// 1. Builtins: bun:*, node:*, ...
// 2. Arquivo relativo: ./foo, ./foo.js, ./foo.ts, ./foo/index.js
// 3. node_modules/foo
//    - /project/node_modules/foo
//    - /node_modules/foo  (sobe no filesystem)

// Testar com Bun:
import { resolve } from "bun";

// Resolve sem executar
const path = await resolve("lodash", import.meta.dir);
console.log("Resolved:", path);
```

### 2. Inspecionar Resolucao

```bash
# Ver o que Bun resolve
BUN_DEBUG_RESOLVER=1 bun -e "import 'express'" 2>&1 | head -30

# Alternativa: bundle e ver imports
bun build --target=node ./script.js 2>&1 | head -20
```

### 3. ESM vs CJS Interop

```javascript
// Bun suporta tanto ESM quanto CJS no mesmo arquivo (diferente do Node)

// ESM import de CJS
import _ from "lodash"; // funciona mesmo lodash sendo CJS

// CJS require de ESM (mais complicado)
const { default: fn } = await import("./esm-module.mjs");

// Bun resolve automaticamente
// Node.js requer configuracao explicita em muitos casos
```

### 4. TypeScript Paths

```json
// tsconfig.json
{
    "compilerOptions": {
        "paths": {
            "@utils/*": ["./src/utils/*"],
            "@lib": ["./src/lib/index.ts"]
        }
    }
}
```

```typescript
// Bun resolve paths do tsconfig sem build step
import { helper } from "@utils/helper"; // src/utils/helper.ts
import lib from "@lib";                  // src/lib/index.ts
```

---

## Security Analysis

### Path Traversal em Resolucao

```javascript
// PERIGO: import com path usuario nao sanitizado
async function loadPlugin(name) {
    // Se name = "../../../../etc/passwd" ???
    const plugin = await import(`./plugins/${name}`);
    return plugin;
}

// Ataque:
// loadPlugin("../../../etc/passwd.js")
// → import("./plugins/../../../etc/passwd.js")
// → carrega /etc/passwd como JS (provavelmente falha, mas vazamento de info)

// CORRETO: validar o nome
function loadPluginSafe(name) {
    if (!/^[a-z0-9-]+$/.test(name)) throw new Error("Nome invalido");
    return import(`./plugins/${name}`);
}
```

### Prototype Pollution via package.json

```bash
# package.json com exports maliciosos
cat > /tmp/evil-pkg/package.json << 'EOF'
{
  "name": "evil",
  "exports": {
    ".": "./index.js",
    "__proto__": "./evil.js"
  }
}
EOF
# Bun lida com isso?
```

### Dependency Confusion

```bash
# Se um pacote interno tem o mesmo nome que um publico
# node_modules/ lookup pode pegar o errado

# Ver ordem de resolucao
node_modules/
├── private-pkg/    # interno
└── ...

# npm install pode sobrescrever com versao publica
# Ataque: publicar pacote com mesmo nome na versão maior
```

---

## Exercises

### Ex 5.1 — Resolution Tracing

```bash
# Trace resolucao de modulos
cat > /tmp/trace_resolve.js << 'EOF'
import { resolve } from "bun";

const modules = ["fs", "path", "crypto", "bun", "bun:ffi"];

for (const mod of modules) {
    try {
        const resolved = await resolve(mod, "/tmp");
        console.log(`${mod} → ${resolved}`);
    } catch (e) {
        console.log(`${mod} → ERROR: ${e.message}`);
    }
}
EOF
bun /tmp/trace_resolve.js
```

### Ex 5.2 — node_modules Lookup

```bash
# Crie hierarquia para testar lookup
mkdir -p /tmp/test-resolve/a/b/c
echo '{"name":"test","version":"1.0.0"}' > /tmp/test-resolve/package.json
mkdir -p /tmp/test-resolve/node_modules/mylib
echo 'export const x = "root"' > /tmp/test-resolve/node_modules/mylib/index.js

mkdir -p /tmp/test-resolve/a/node_modules/mylib
echo 'export const x = "nested"' > /tmp/test-resolve/a/node_modules/mylib/index.js

# Qual versao e carregada de /tmp/test-resolve/a/b/c?
cat > /tmp/test-resolve/a/b/c/test.js << 'EOF'
import { x } from "mylib";
console.log(x); // "nested" ou "root"?
EOF
bun /tmp/test-resolve/a/b/c/test.js
```

### Ex 5.3 — Path Traversal Audit

```javascript
// Teste se path traversal e possivel
const dangerous = [
    "../../../etc/passwd",
    "..\\..\\windows\\system32",
    "%2e%2e%2f%2e%2e%2f",
    "./\0evil",
];

for (const path of dangerous) {
    try {
        const resolved = await import.meta.resolve(path, "file:///tmp/");
        console.log(`RESOLVEU: ${path} → ${resolved}`);
    } catch (e) {
        console.log(`BLOQUEOU: ${path}`);
    }
}
```

---

## Checkpoint

[ ] Entende a ordem de lookup: builtin → relativo → node_modules
[ ] Sabe que Bun sobe no filesystem procurando node_modules
[ ] Testa path traversal em imports dinamicos
[ ] Entende ESM/CJS interop no Bun
[ ] Configura e testa TypeScript paths

---

## Next

→ [`../memory/01-allocator`](../../memory/01-allocator/) — gerenciamento de memoria no Bun
