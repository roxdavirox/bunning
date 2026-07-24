# Buffers — Buffer, TypedArrays, e Memoria Compartilhada

> Como Bun gerencia memoria binaria, SharedArrayBuffer, e a fronteira JS/native.

---

## Intuition (Feynman)

Buffer e TypedArray sao janelas para memoria binaria crua. Um `Uint8Array` de 1000 bytes e simplesmente 1000 bytes de memoria, sem interpretacao — voce decide o que significa cada byte.

A magia perigosa: um `ArrayBuffer` pode ser acessado por MULTIPLAS views ao mesmo tempo. E `SharedArrayBuffer` pode ser acessado por MULTIPLAS threads simultaneamente. Isso cria superficies de ataque interessantes — timing attacks, race conditions, e vazamentos de informacao.

---

## Source Code

No repositorio `oven-sh/bun`:
```
src/
├── bun.js/
│   └── bindings/
│       └── Buffer.h         # Node.js Buffer compat
├── node/
│   └── buffer.zig           # Implementacao Buffer
└── ...
```

---

## Hands-On Analysis

### 1. Hierarquia de Tipos

```javascript
// ArrayBuffer: memoria crua, sem acesso direto
const raw = new ArrayBuffer(16);

// TypedArrays: views tipadas sobre ArrayBuffer
const u8  = new Uint8Array(raw);   // bytes
const u32 = new Uint32Array(raw);  // uint32 (4 bytes each)
const f64 = new Float64Array(raw); // float64 (8 bytes each)

// Todas apontam para os MESMOS 16 bytes
u8[0] = 0xFF;
console.log(u32[0].toString(16)); // FF000000 ou 000000FF (endianness!)

// DataView: acesso manual com controle de endianness
const view = new DataView(raw);
view.setUint32(0, 0xDEADBEEF, true); // little-endian
view.setUint32(4, 0xCAFEBABE, false); // big-endian
```

### 2. Node.js Buffer no Bun

```javascript
// Buffer e uma subclasse de Uint8Array com helpers
const buf = Buffer.from("Hello, World!", "utf-8");
console.log(buf.length);          // 13
console.log(buf[0].toString(16)); // 48 (H)
console.log(buf.toString("hex")); // 48656c6c6f2c20576f726c6421
console.log(buf.toString("base64")); // SGVsbG8sIFdvcmxkIQ==

// Buffer pool: Bun/Node aloca de um pool pre-alocado para buffers pequenos
const small = Buffer.allocUnsafe(10); // nao inicializado (pode ter dados antigos!)
const safe  = Buffer.alloc(10);       // inicializado com zeros
```

### 3. SharedArrayBuffer

```javascript
// SharedArrayBuffer: compartilhado entre Worker threads
const sab = new SharedArrayBuffer(1024);
const shared = new Int32Array(sab);

// Worker pode ler/escrever os mesmos bytes
// Precisa de Atomics para sincronizar

Atomics.store(shared, 0, 42);
const val = Atomics.load(shared, 0);
console.log(val); // 42

// Atomics.wait / Atomics.notify: mutex/condvar primitivos
// Atomics.add, sub, and, or, xor: atomic arithmetic
```

### 4. Zero-Copy com Bun

```javascript
// Bun otimiza para evitar copias desnecessarias
const file = Bun.file("/etc/hostname");
const bytes = await file.bytes(); // Uint8Array, potencialmente zero-copy

// Criar response sem copiar
const response = new Response(bytes, {
    headers: { "Content-Type": "text/plain" }
});

// Bun.write: zero-copy disk write quando possivel
await Bun.write("/tmp/output.txt", bytes);
```

---

## Security Analysis

### Buffer Over-Read (allocUnsafe)

```javascript
// PERIGO: allocUnsafe pode expor memoria reciclada
const leak = Buffer.allocUnsafe(1024);
// leak pode conter dados de requests anteriores!

// Teste: quantos bytes nao-zero?
const nonZero = [...leak].filter(b => b !== 0).length;
console.log(`Bytes nao-zero: ${nonZero} / 1024`);

// CORRETO: sempre use Buffer.alloc() para dados sensiveis
const safe = Buffer.alloc(1024); // garantidamente zeros
```

### Spectre via SharedArrayBuffer

```javascript
// Spectre usa timing de SharedArrayBuffer para vazar dados
// Por isso browsers restringiram SAB (requer Cross-Origin Isolation)

// Bun nao tem essas restricoes — SAB disponivel livremente
const sab = new SharedArrayBuffer(1024 * 1024);
const view = new Uint8Array(sab);

// Timing attack basico (demo conceitual)
function measureAccess(index) {
    const start = Date.now();
    view[index]; // acesso
    return Date.now() - start;
}

// Em Spectre real: diferenca de tempo indica se dado esta em cache
// Bun em servidor: nao tem atacante remoto diretamente, mas...
// Se Bun executa codigo de usuario com SAB: vetor potencial
```

### Type Confusion via Shared Memory

```javascript
// Leia como float32, escreva como uint32 — mesmos bytes, tipos diferentes
const buf = new ArrayBuffer(4);
const f32 = new Float32Array(buf);
const u32 = new Uint32Array(buf);

// Escreve float
f32[0] = 1.0;
console.log(u32[0].toString(16)); // 3f800000 (IEEE 754 de 1.0)

// Escreve uint que e NaN como float
u32[0] = 0x7FC00000; // NaN pattern
console.log(f32[0]); // NaN

// Esta tecnica e usada em exploits de type confusion JS
```

---

## Exercises

### Ex M3.1 — Binary Parser

```javascript
// Escreva um parser de formato binario simples
// Formato: [magic(4)] [version(2)] [length(4)] [data(length)]

function parsePacket(buf) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let offset = 0;

    const magic = view.getUint32(offset, false); offset += 4;
    if (magic !== 0xDEADBEEF) throw new Error("Magic invalido");

    const version = view.getUint16(offset, false); offset += 2;
    const length  = view.getUint32(offset, false); offset += 4;
    const data    = buf.slice(offset, offset + length);

    return { version, data };
}

// Criar pacote de teste
const packet = new Uint8Array(14);
const dv = new DataView(packet.buffer);
dv.setUint32(0, 0xDEADBEEF, false);
dv.setUint16(4, 2, false);
dv.setUint32(6, 4, false);
dv.setUint8(10, 0x41); // 'A'
dv.setUint8(11, 0x42); // 'B'
dv.setUint8(12, 0x43); // 'C'
dv.setUint8(13, 0x44); // 'D'

console.log(parsePacket(packet));
```

### Ex M3.2 — allocUnsafe Audit

```javascript
// Quantos dados antigos aparecem em allocUnsafe?
const trials = 100;
let leakCount = 0;

for (let i = 0; i < trials; i++) {
    // Aloca e descarta dados "sensiveis"
    const secret = Buffer.alloc(64);
    secret.write("SENHA_SECRETA_123", "utf-8");

    // Agora aloca unsafe do mesmo tamanho
    const leak = Buffer.allocUnsafe(64);
    if (leak.includes("SENHA")) leakCount++;
}

console.log(`Leaks detectados: ${leakCount}/${trials}`);
// Resultado varia - demonstra o risco
```

### Ex M3.3 — SharedArrayBuffer Worker

```javascript
// Comunicacao entre workers via SAB
import { Worker, workerData } from "bun";

if (!workerData) {
    const sab = new SharedArrayBuffer(4);
    const counter = new Int32Array(sab);

    const worker = new Worker(import.meta.url, {
        workerData: { sab }
    });

    await new Promise(r => setTimeout(r, 100));
    console.log("Counter pelo worker:", Atomics.load(counter, 0));
    worker.terminate();
} else {
    const counter = new Int32Array(workerData.sab);
    Atomics.add(counter, 0, 42);
}
```

---

## Checkpoint

[ ] Entende hierarquia: ArrayBuffer → TypedArray → DataView
[ ] Sabe diferenca entre Buffer.alloc e Buffer.allocUnsafe
[ ] Demonstrou risco de dados antigos em allocUnsafe
[ ] Implementou parser binario com DataView
[ ] Usou SharedArrayBuffer com Atomics

---

## Next

→ [`04-safety`](../04-safety/) — tecnicas de memoria segura e hardening
