# JSC Integration — JavaScriptCore no Bun

> Como o engine JavaScript da Apple e embedado e controlado pelo Bun.

---

## Intuition (Feynman)

JavaScriptCore (JSC) e o engine JS do Safari/WebKit. Bun nao escreveu um engine JS do zero — usou o da Apple e integrou profundamente.

Pense assim: o Bun e como um carro customizado. O motor (JSC) vem da Apple. O chassi, a transmissao, e os controles (runtime APIs, FFI, HTTP, etc) sao do Bun, escritos em Zig.

A integracao acontece via C API do JSC: Bun chama funcoes C que falam com o engine JS. Isso cria uma fronteira C↔Zig↔JS que e critica para seguranca.

---

## Source Code

No repositorio `oven-sh/bun`:
```
src/
├── bun.js/
│   ├── api/           # APIs JS expostas ao usuario
│   ├── bindings/      # Bindings Zig → JSC
│   └── ...
├── jsc.zig            # Interface principal com JSC
├── js_bindings.zig    # Bindings especificos
└── ...

# JSC headers (Apple)
vendor/WebKit/Source/JavaScriptCore/API/
├── JSBase.h
├── JSContext.h
├── JSValue.h
└── ...
```

---

## Hands-On Analysis

### 1. JSC API Basica

```c
// C API do JSC (o que Bun usa internamente)
#include <JavaScriptCore/JavaScript.h>

JSContextRef ctx = JSGlobalContextCreate(NULL);
JSStringRef script = JSStringCreateWithUTF8CString("1 + 2");
JSValueRef result = JSEvaluateScript(ctx, script, NULL, NULL, 0, NULL);

double value = JSValueToNumber(ctx, result, NULL);
// value == 3.0

JSStringRelease(script);
JSGlobalContextRelease(ctx);
```

### 2. Inspecionar JSC no Binario

```bash
# JSC deixa rastros
strings $(which bun) | grep -iE "JavaScriptCore|WebKit" | head -10

# Funcoes JSC exportadas/importadas
nm -D $(which bun) 2>/dev/null | grep -i "JS" | head -20

# Versao do WebKit/JSC
strings $(which bun) | grep -iE "webkit|[0-9]+\.[0-9]+\.[0-9]+" | head -5
```

### 3. Tipos em JSC

```typescript
// Do lado JS, JSC tem tipos especiais

// JSC-specific: não existe em V8 (Node.js/Chrome)
// 1. Rope strings (strings concatenadas lazy)
const huge = "a".repeat(1000000) + "b".repeat(1000000);

// 2. Symbols internos do JSC (diferentes do V8)
const sym = Symbol("test");
console.log(Object.getOwnPropertyNames(globalThis).length);

// 3. Intrinsics diferentes
// JSC pode ter otimizacoes diferentes do V8
```

### 4. JIT em JSC

```javascript
// JSC tem 4 tiers de compilacao:
// 1. LLInt (Low Level Interpreter) — interpretado
// 2. Baseline JIT — compilado basico
// 3. DFG JIT (Data Flow Graph) — otimizado
// 4. FTL JIT (Faster Than Light) — super otimizado

// Teste JIT heating:
function hotFunction(x) {
    return x * 2 + 1;
}

// Executa muitas vezes para ativar JIT
for (let i = 0; i < 100000; i++) {
    hotFunction(i);
}

console.time("after-jit");
for (let i = 0; i < 1000000; i++) hotFunction(i);
console.timeEnd("after-jit");
```

---

## Security Analysis

### Fronteira JSC ↔ Zig

```
JavaScript Code
     ↓ (JSC evaluates)
JSC C API
     ↓ (Zig calls C)
Zig bindings (src/bun.js/bindings/)
     ↓ (native code)
OS / Libc / Network
```

Cada transicao e um vetor:

1. **JS → JSC**: type confusion, JIT spray
2. **JSC C API**: use-after-free de JSValues
3. **Zig bindings**: memory safety boundary

### Historico de Vulnerabilidades JSC

```bash
# JSC tem historico de exploits (Safari JIT)
# CVE-2022-32893, CVE-2023-23529, etc

# Verificar versao do WebKit embedado
strings $(which bun) | grep -iE "r[0-9]{6}|webkit [0-9]" | head -5

# Comparar com CVEs conhecidos para aquela versao
```

### JSC vs V8 Security

| Aspecto | V8 (Node/Chrome) | JSC (Bun/Safari) |
|---------|-----------------|-----------------|
| JIT | Turbofan | FTL (LLVM-based) |
| Sandbox | Site Isolation | Limited in Bun |
| Exploit history | Frequente | Frequente |
| Security team | Google | Apple |
| Update frequency | Weekly | Irregular (Bun) |

---

## Exercises

### Ex 3.1 — Engine Detection

```javascript
// Detecte se esta rodando em JSC ou V8
function detectEngine() {
    // JSC tem propriedades que V8 nao tem
    if (typeof $vm !== 'undefined') return 'JSC';

    // V8-specific
    if (typeof v8 !== 'undefined') return 'V8';

    // Behavior-based detection
    try {
        // JSC e V8 tem comportamentos diferentes em edge cases
        const x = new Float64Array([NaN]);
        const y = new Uint32Array(x.buffer);
        return y[0] === 0 ? 'JSC-like' : 'V8-like';
    } catch (e) {
        return 'unknown';
    }
}

console.log(detectEngine());
```

### Ex 3.2 — JSC Internals

```bash
# Bun expoe alguns internals JSC
bun repl << 'EOF'
// Quantos contextos JSC existem?
console.log(typeof globalThis);

// Properties nao-standard do Bun
console.log(Object.keys(Bun));

// Runtime info
console.log(process.versions);
EOF
```

### Ex 3.3 — JIT Timing

```javascript
// Meca o impacto do JIT
function bench(fn, iterations) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) fn(i);
    return performance.now() - start;
}

function add(x) { return x + 1; }

// Cold (LLInt)
const cold = bench(add, 100);

// Hot (JIT compilado)
const hot = bench(add, 1000000);

console.log(`Cold: ${cold}ms`);
console.log(`Hot: ${hot}ms`);
console.log(`Speedup: ${(cold/hot * 10).toFixed(2)}x`);
```

### Ex 3.4 — Memory Comparison

```bash
# Bun vs Node: uso de memoria para o mesmo script
cat > /tmp/hello.js << 'EOF'
console.log("hello world");
EOF

# Node.js RSS
node --v8-options 2>/dev/null | head -3
/usr/bin/time -v node /tmp/hello.js 2>&1 | grep "Maximum resident"

# Bun RSS
/usr/bin/time -v bun /tmp/hello.js 2>&1 | grep "Maximum resident"
```

---

## Checkpoint

[ ] Entende que JSC e o engine JS (nao V8)
[ ] Sabe a fronteira Zig ↔ JSC ↔ JavaScript
[ ] Identifica strings JSC/WebKit no binario
[ ] Executa deteccao de engine no Bun
[ ] Entende os 4 tiers de JIT do JSC

---

## Next

→ [`04-event-loop`](../04-event-loop/) — como o event loop funciona no Bun
