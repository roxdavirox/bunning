# Zig Bindings — Como Bun Expoe Zig para JavaScript

> A camada que conecta o mundo Zig (nativo) com o mundo JavaScript (JSC).

---

## Intuition (Feynman)

Imagine que voce tem um especialista em Zig (que fala uma lingua tecnica) e um cliente em JavaScript (que fala outra lingua). Os "bindings" sao os interpretes: eles traduzem chamadas JS para instrucoes Zig e vice-versa.

O Bun faz isso para TUDO: `Bun.file()`, `Bun.serve()`, `fetch()` — cada uma dessas chamadas JS acaba chamando codigo Zig por baixo. Entender como essa traducao funciona e essencial para entender como atacar a fronteira.

---

## Source Code

No repositorio `oven-sh/bun`:
```
src/
├── bun.js/
│   ├── bindings/          # C++ que cola JSC com Zig
│   │   ├── bindings.cpp
│   │   ├── ZigGlobalObject.cpp
│   │   └── ...
│   └── api/               # APIs JavaScript expostas
│       ├── BunObject.zig   # Namespace Bun.*
│       ├── Server.zig      # Bun.serve()
│       └── ...
└── jsc.zig                # Interface JSC de baixo nivel
```

---

## Hands-On Analysis

### 1. Anatomia de um Binding

```zig
// Exemplo simplificado de como Bun implementa um binding
// (baseado no padrao real do codigo Bun)

// 1. Funcao Zig que implementa logica
fn getHostname(allocator: std.mem.Allocator) ![]u8 {
    var buf: [256]u8 = undefined;
    const result = std.posix.gethostname(&buf);
    return try allocator.dupe(u8, result);
}

// 2. Wrapper que converte para tipos JSC
fn jsGetHostname(
    globalThis: *JSGlobalObject,
    callframe: *CallFrame,
) callconv(.C) JSValue {
    _ = callframe;
    const allocator = globalThis.bunVM().allocator;
    const hostname = getHostname(allocator) catch return JSValue.jsUndefined();
    defer allocator.free(hostname);
    return JSValue.createStringFromBytes(globalThis, hostname);
}

// 3. Registro na tabela de funcoes
// (tabela mapeada pelo nome "hostname" para jsGetHostname)
```

### 2. Inspecionar Bindings Disponiveis

```javascript
// Ver o que esta disponivel no namespace Bun
console.log(Object.getOwnPropertyNames(Bun).sort());

// Inspecionar tipos
for (const key of Object.getOwnPropertyNames(Bun)) {
    const val = Bun[key];
    console.log(`Bun.${key}: ${typeof val}`);
}
```

### 3. Tracing de Chamadas

```bash
# Rastrear syscalls geradas por chamadas Bun
cat > /tmp/bun_calls.js << 'EOF'
const file = Bun.file("/etc/hostname");
const text = await file.text();
console.log(text.trim());
EOF

# Trace abertura de arquivo
strace -e trace=openat,read,close bun /tmp/bun_calls.js 2>&1 | grep -v "ENOENT"
```

### 4. Error Handling na Fronteira

```javascript
// Como erros Zig chegam ao JavaScript
try {
    const file = Bun.file("/nao/existe/arquivo");
    await file.text();
} catch (e) {
    console.log("Tipo:", e.constructor.name);
    console.log("Code:", e.code);    // ENOENT
    console.log("Errno:", e.errno);  // -2
    console.log("Syscall:", e.syscall); // "open"
}
// Bun mapeia erros POSIX para erros JS com propriedades extras
```

---

## Security Analysis

### Fronteira de Privilegios

```
JS (sandboxed) → JSC → bindings (C++) → Zig → syscalls (privilegiado)
```

A fronteira JS/Zig e onde a sandbox JS termina:

```javascript
// Do lado JS: tudo parece seguro
const file = Bun.file("/etc/shadow");

// Mas por baixo: Zig faz open("/etc/shadow", O_RDONLY, 0)
// Se o processo tem privilegios: le o arquivo
// Se nao tem: erro EACCES

// Nao ha verificacao em Bun (diferente do Deno com --allow-read)
```

### Type Safety na Fronteira

```javascript
// O que acontece com tipos inesperados?
try {
    // Passar null onde string e esperado
    const file = Bun.file(null);
    console.log("null aceito");
} catch (e) {
    console.log("null rejeitado:", e.message);
}

try {
    // Objeto onde string e esperado
    const file = Bun.file({ toString: () => "/etc/hostname" });
    console.log(await file.text());
} catch (e) {
    console.log("objeto rejeitado:", e.message);
}
```

---

## Exercises

### Ex F3.1 — API Surface Mapping

```javascript
// Mapear toda a API surface do Bun
function mapAPI(obj, prefix = "", depth = 0) {
    if (depth > 2) return;

    for (const key of Object.getOwnPropertyNames(obj)) {
        if (key.startsWith("_")) continue;
        const val = obj[key];
        const path = prefix ? `${prefix}.${key}` : key;

        console.log(`${path}: ${typeof val}`);

        if (typeof val === "object" && val !== null && depth < 1) {
            mapAPI(val, path, depth + 1);
        }
    }
}

mapAPI(Bun, "Bun");
```

### Ex F3.2 — Error Code Mapping

```javascript
// Mapear codigos de erro Zig/POSIX para erros JS
const errorCodes = [
    ["/etc/shadow", "EACCES esperado"],
    ["/nao/existe", "ENOENT esperado"],
    ["/etc/hostname", "sucesso esperado"],
];

for (const [path, desc] of errorCodes) {
    try {
        const text = await Bun.file(path).text();
        console.log(`${path}: OK (${text.length} bytes) — ${desc}`);
    } catch (e) {
        console.log(`${path}: ${e.code} (errno ${e.errno}) — ${desc}`);
    }
}
```

### Ex F3.3 — Binding Performance

```javascript
// Medir overhead da fronteira JS/Zig
const ITERATIONS = 100_000;

// Operacao JS pura
const jsStart = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    Math.random();
}
const jsTime = performance.now() - jsStart;

// Operacao que cruza fronteira JS/Zig
const zigStart = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    Bun.hash("test" + i);
}
const zigTime = performance.now() - zigStart;

console.log(`JS puro: ${jsTime.toFixed(2)}ms`);
console.log(`JS→Zig: ${zigTime.toFixed(2)}ms`);
console.log(`Overhead por chamada: ${((zigTime - jsTime) / ITERATIONS * 1000).toFixed(3)}μs`);
```

---

## Checkpoint

[ ] Entende a pilha: JS → JSC → C++ → Zig → syscall
[ ] Mapeou a API surface do Bun
[ ] Testou comportamento com tipos invalidos
[ ] Mediu overhead da fronteira JS/Zig
[ ] Entende que a fronteira JS/native e onde a sandbox termina

---

## Next

→ [`04-syscalls`](../04-syscalls/) — interface direta com syscalls do kernel
