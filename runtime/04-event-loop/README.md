# Event Loop — Como Bun Gerencia I/O Assincrono

> libuv vs io_uring, microtasks, macrotasks, e diferencias com Node.js.

---

## Intuition (Feynman)

O event loop e como um garcom em um restaurante movimentado. Ele nao fica parado esperando a cozinha (disco, rede). Em vez disso, anota os pedidos (registra callbacks), vai fazer outras coisas (executa outro JS), e quando a cozinha avisa (I/O completo), entrega o prato (executa o callback).

Bun usa `io_uring` no Linux (API moderna do kernel) em vez de libuv (que Node usa). io_uring permite batch de operacoes I/O com menos syscalls, o que e mais rapido mas tem surface de ataque diferente.

---

## Source Code

No repositorio `oven-sh/bun`:
```
src/
├── io/
│   ├── io.zig         # Abstraction layer
│   └── io_linux.zig   # io_uring implementation
├── event_loop.zig     # Core event loop
├── uws/               # µWebSockets (networking)
└── async/             # Async primitives
```

---

## Hands-On Analysis

### 1. Ordem de Execucao

```javascript
// Mapa da ordem do event loop

console.log("1 - sync");

setTimeout(() => console.log("5 - macrotask"), 0);

Promise.resolve().then(() => console.log("3 - microtask"));

queueMicrotask(() => console.log("4 - microtask 2"));

console.log("2 - sync");

// Saida: 1, 2, 3, 4, 5
// Microtasks SEMPRE antes de macrotasks
```

### 2. io_uring vs libuv

```bash
# Verificar se Bun usa io_uring (Linux)
strace -e trace=io_uring_setup,io_uring_enter,io_uring_register \
    bun -e "await Bun.file('/etc/hostname').text()" 2>&1 | head -20

# Verificar Node.js (usa epoll via libuv)
strace -e trace=epoll_create1,epoll_wait,epoll_ctl \
    node -e "require('fs').readFile('/etc/hostname', () => {})" 2>&1 | head -20
```

### 3. Benchmark I/O

```javascript
// Benchmark: leitura de arquivo
async function benchRead(runtime) {
    const iterations = 1000;
    const start = performance.now();

    const promises = Array.from({ length: iterations }, () =>
        Bun.file("/etc/hostname").text()
    );

    await Promise.all(promises);
    const elapsed = performance.now() - start;

    console.log(`${iterations} reads: ${elapsed.toFixed(2)}ms`);
    console.log(`Throughput: ${(iterations / elapsed * 1000).toFixed(0)} reads/sec`);
}

benchRead();
```

### 4. Timer Resolution

```javascript
// Bun vs Node: precisao de timers
const timings = [];

for (let i = 0; i < 10; i++) {
    const start = performance.now();
    await new Promise(r => setTimeout(r, 1));
    timings.push(performance.now() - start);
}

const avg = timings.reduce((a, b) => a + b) / timings.length;
console.log(`Timer avg: ${avg.toFixed(3)}ms`);
console.log(`Min: ${Math.min(...timings).toFixed(3)}ms`);
console.log(`Max: ${Math.max(...timings).toFixed(3)}ms`);
```

---

## Security Analysis

### io_uring: Poder e Risco

```bash
# io_uring tem historico de vulnerabilidades kernel
# CVE-2022-1043, CVE-2023-2598, etc

# Verificar versao do kernel
uname -r

# io_uring permite operacoes kernel diretas
# Exploits container escape usaram io_uring

# Verificar se io_uring e permitido no container
cat /proc/sys/kernel/io_uring_disabled 2>/dev/null || echo "parametro nao existe"
```

### Denial of Service via Event Loop

```javascript
// Bloquear o event loop e facil — tudo e single-threaded
// Isso afeta TODOS os requests simultaneos

// MAU: bloqueia o loop
function maliciousCPU(n) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Math.sqrt(i);
    return sum;
}

// Em um servidor Bun, isso bloqueia todos os outros clientes
maliciousCPU(1_000_000_000);

// BOM: usar Worker threads para CPU-bound
import { Worker } from "bun";
```

### Microtask Starvation

```javascript
// Microtasks podem starvar macrotasks (timers, I/O callbacks)
function recursiveMicrotask(n) {
    if (n <= 0) return;
    Promise.resolve().then(() => recursiveMicrotask(n - 1));
}

// Isso pode atrasar indefinidamente outros callbacks
recursiveMicrotask(1000000);
```

---

## Exercises

### Ex 4.1 — Event Loop Tracing

```bash
# Trace syscalls durante operacao async
cat > /tmp/async_test.js << 'EOF'
const data = await Bun.file('/etc/hostname').text();
console.log(data.trim());
EOF

strace -c bun /tmp/async_test.js 2>&1 | tail -20
# Quais syscalls dominam?
```

### Ex 4.2 — Microtask vs Macrotask

```javascript
// Implemente um scheduler simples para visualizar a ordem
const events = [];

function track(name) {
    events.push({ name, time: performance.now() });
}

setTimeout(() => track("setTimeout"), 0);
setImmediate?.(() => track("setImmediate")) ?? track("setImmediate N/A");
Promise.resolve().then(() => track("Promise.then"));
queueMicrotask(() => track("queueMicrotask"));

await new Promise(r => setTimeout(r, 10));

events.sort((a, b) => a.time - b.time);
events.forEach(e => console.log(e.name));
```

### Ex 4.3 — Blocking Detector

```javascript
// Detecte quando o event loop esta bloqueado
let lastTick = Date.now();

setInterval(() => {
    const now = Date.now();
    const lag = now - lastTick - 10; // esperamos ~10ms
    if (lag > 5) {
        console.warn(`Event loop lag: ${lag}ms`);
    }
    lastTick = now;
}, 10);

// Simule trabalho CPU-bound
setTimeout(() => {
    console.log("Iniciando trabalho pesado...");
    const start = Date.now();
    while (Date.now() - start < 100) {}
    console.log("Trabalho pesado completo");
}, 100);
```

---

## Checkpoint

[ ] Entende a ordem: sync → microtasks → macrotasks
[ ] Sabe que Bun usa io_uring no Linux
[ ] Consegue tracejar syscalls com strace
[ ] Entende por que bloquear o event loop e perigoso
[ ] Sabe como microtasks podem starvar I/O callbacks

---

## Next

→ [`05-module-resolution`](../05-module-resolution/) — como Bun resolve imports
