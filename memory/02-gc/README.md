# GC — Garbage Collection do JSC e Interacao com Zig

> Como o GC do JavaScriptCore funciona e como Bun/Zig coordena com ele.

---

## Intuition (Feynman)

JavaScript tem garbage collector — voce cria objetos e esquece, o GC limpa quando necessario. Zig nao tem GC — voce aloca e libera manualmente.

Bun vive nos dois mundos: objetos JS sao gerenciados pelo GC do JSC, mas os dados nativos (buffers de rede, handles de arquivo) sao gerenciados manualmente em Zig. A fronteira entre esses dois mundos e onde bugs sutis acontecem: o GC pode coletar um objeto JS enquanto Zig ainda tem um ponteiro para os dados nativos associados.

---

## Source Code

No repositorio `oven-sh/bun`:
```
src/
├── bun.js/
│   └── bindings/
│       └── bindings.cpp    # JSC finalizers
├── jsc.zig                 # GC interface
└── ...

# JSC GC internals (WebKit):
Source/JavaScriptCore/heap/
├── Heap.cpp
├── HeapInlines.h
├── MarkedBlock.h
└── ...
```

---

## Hands-On Analysis

### 1. GC do JSC

```javascript
// JSC usa um GC tri-color mark-and-sweep
// com generational collection

// Objetos "jovens" ficam no nursery (coletado frequente)
// Objetos "velhos" ficam no old space (coletado raro)

// Forcar GC (nao disponivel publicamente, mas alguns runtimes expoe)
// Em Bun, nao ha Bun.gc() publico

// Detectar GC via performance
let before = process.memoryUsage().heapUsed;

// Aloca e descarta muitos objetos
for (let i = 0; i < 1000000; i++) {
    const obj = { x: i, y: i * 2, z: i.toString() };
}

// GC deve ter rodado
const after = process.memoryUsage().heapUsed;
console.log(`Heap antes: ${(before / 1024 / 1024).toFixed(2)}MB`);
console.log(`Heap depois: ${(after / 1024 / 1024).toFixed(2)}MB`);
```

### 2. Finalizers e Recursos Nativos

```typescript
// Bun usa FinalizationRegistry para limpar recursos nativos
// quando o objeto JS e coletado

// Exemplo conceitual do que Bun faz internamente:
const registry = new FinalizationRegistry((nativeHandle) => {
    // Libera o recurso nativo quando o objeto JS e coletado
    nativeClose(nativeHandle);
});

class FileHandle {
    #handle: number;

    constructor(path: string) {
        this.#handle = nativeOpen(path);
        // Registra callback de limpeza
        registry.register(this, this.#handle, this);
    }

    close() {
        nativeClose(this.#handle);
        registry.unregister(this);
    }
}
```

### 3. Memory Usage

```bash
# Monitorar uso de heap JS
cat > /tmp/gc_test.js << 'EOF'
const { heapUsed, heapTotal, external, rss } = process.memoryUsage();

console.log(`Heap Used: ${(heapUsed / 1024 / 1024).toFixed(2)} MB`);
console.log(`Heap Total: ${(heapTotal / 1024 / 1024).toFixed(2)} MB`);
console.log(`External: ${(external / 1024 / 1024).toFixed(2)} MB`);
console.log(`RSS: ${(rss / 1024 / 1024).toFixed(2)} MB`);
EOF

bun /tmp/gc_test.js
node /tmp/gc_test.js
```

### 4. Weak References

```javascript
// WeakRef: referencia que nao impede GC
const cache = new Map();

function getCached(key, createFn) {
    const ref = cache.get(key);
    const existing = ref?.deref();

    if (existing) return existing;

    const value = createFn();
    cache.set(key, new WeakRef(value));
    return value;
}

// Objetos podem ser coletados se nao ha referencia forte
let bigObj = { data: new ArrayBuffer(10 * 1024 * 1024) }; // 10MB
const ref = new WeakRef(bigObj);

bigObj = null; // Remove referencia forte
// ref.deref() pode retornar undefined apos GC
```

---

## Security Analysis

### JSC GC Vulnerabilidades Historicas

```bash
# GC bugs sao uma das categorias mais perigosas de vulnerabilidades JS
# porque podem levar a use-after-free no engine

# Categorias principais:
# 1. Use-after-GC: objeto coletado mas ponteiro mantido
# 2. Type confusion: GC move objeto, tipo muda
# 3. GC timing: race condition durante coleta

# Verificar versao do JSC (indica exposure a CVEs conhecidos)
strings $(which bun) | grep -iE "r2[0-9]{5}|webkit [0-9]" | head -5
```

### Memory Exhaustion

```javascript
// Ataque: esgotar memoria do processo
// Pode causar OOM killer matar o processo

// Detectar antes de ser OOM-killed
process.on('warning', (warning) => {
    if (warning.name === 'MaxListenersExceededWarning') return;
    console.error('Warning:', warning.message);
});

// Limite de memoria
const limit = 512 * 1024 * 1024; // 512MB
const arrays = [];

function allocateUntilLimit() {
    const { heapUsed } = process.memoryUsage();
    if (heapUsed > limit) {
        console.log(`Limite atingido: ${(heapUsed / 1024 / 1024).toFixed(0)}MB`);
        return;
    }
    arrays.push(new ArrayBuffer(1024 * 1024)); // 1MB por vez
    setTimeout(allocateUntilLimit, 0);
}
```

### GC Pause em Servidor

```javascript
// GC pauses podem afetar latencia de requests
// Medir pauses do GC

let lastCheck = Date.now();
const pauses = [];

setInterval(() => {
    const now = Date.now();
    const delta = now - lastCheck - 1; // esperamos ~1ms
    if (delta > 5) {
        pauses.push(delta);
        console.warn(`Possivel GC pause: ${delta}ms`);
    }
    lastCheck = now;
}, 1);

// Simular carga
setTimeout(() => {
    const data = [];
    for (let i = 0; i < 100000; i++) {
        data.push({ index: i, str: `item-${i}` });
    }
    console.log(`${data.length} objetos alocados`);
}, 100);
```

---

## Exercises

### Ex M2.1 — GC Timing

```javascript
// Meca quando o GC roda
const measurements = [];
let lastMemory = process.memoryUsage().heapUsed;

const interval = setInterval(() => {
    const current = process.memoryUsage().heapUsed;
    const delta = current - lastMemory;

    if (delta < -1024 * 1024) { // queda > 1MB = provavelmente GC
        measurements.push({ time: Date.now(), collected: -delta });
    }

    lastMemory = current;
}, 10);

// Aloca objetos por 5 segundos
const start = Date.now();
const data = [];
while (Date.now() - start < 5000) {
    data.push(new Array(1000).fill(Math.random()));
    if (data.length > 10000) data.splice(0, 5000);
    await new Promise(r => setImmediate(r));
}

clearInterval(interval);
console.log(`GC rodou ${measurements.length} vezes em 5s`);
measurements.forEach(m => console.log(`  Coletou ~${(m.collected / 1024 / 1024).toFixed(1)}MB`));
```

### Ex M2.2 — WeakRef Cache

```javascript
// Implemente cache com WeakRef (evita memory leak)
class WeakCache {
    #cache = new Map();
    #registry = new FinalizationRegistry(key => {
        // Remove entrada morta do mapa
        if (this.#cache.get(key)?.deref() === undefined) {
            this.#cache.delete(key);
        }
    });

    set(key, value) {
        const ref = new WeakRef(value);
        this.#cache.set(key, ref);
        this.#registry.register(value, key);
    }

    get(key) {
        return this.#cache.get(key)?.deref();
    }

    get size() { return this.#cache.size; }
}

const cache = new WeakCache();
let obj = { data: "important" };
cache.set("key1", obj);

console.log(cache.get("key1")); // { data: "important" }
obj = null; // Permite GC
```

### Ex M2.3 — Comparar GC

```bash
# Bun JSC vs Node V8: como diferem em memoria
cat > /tmp/gc_bench.js << 'EOF'
const ITERATIONS = 1000000;
const start = Date.now();
const initial = process.memoryUsage().heapUsed;

for (let i = 0; i < ITERATIONS; i++) {
    const obj = { x: i, y: Math.random(), z: i.toString() };
    // obj e coletado imediatamente
}

const elapsed = Date.now() - start;
const peak = process.memoryUsage().heapUsed;

console.log(`Tempo: ${elapsed}ms`);
console.log(`Pico de heap: ${((peak - initial) / 1024 / 1024).toFixed(2)}MB`);
console.log(`Objetos/s: ${(ITERATIONS / elapsed * 1000).toFixed(0)}`);
EOF

echo "=== Bun ===" && bun /tmp/gc_bench.js
echo "=== Node ===" && node /tmp/gc_bench.js
```

---

## Checkpoint

[ ] Entende a fronteira GC (JSC) vs manual (Zig)
[ ] Sabe como FinalizationRegistry funciona
[ ] Implementou cache com WeakRef
[ ] Mede GC pauses via monitoramento de heapUsed
[ ] Compara comportamento GC Bun vs Node

---

## Next

→ [`03-buffers`](../03-buffers/) — Buffer, TypedArrays, e memoria compartilhada
