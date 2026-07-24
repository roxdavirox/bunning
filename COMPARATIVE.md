# COMPARATIVE — Bun vs Node vs Deno vs Browser vs libc

> Analise comparativa profunda: arquitetura, syscalls, memory model, security model.
>
> Use como referencia constante durante o estudo para entender o que Bun faz diferente.

---

## 1. Stack Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION CODE                              │
│                        (JavaScript/TypeScript)                          │
├─────────────────────────────────────────────────────────────────────────┤
│   Node.js        │     Deno        │      Bun       │    Browser       │
├──────────────────┼─────────────────┼────────────────┼──────────────────┤
│  V8 Engine       │   V8 Engine     │  JSC Engine    │  V8/JSC/Spider   │
│  (Google)        │   (Google)      │  (Apple)       │  (varies)        │
├──────────────────┼─────────────────┼────────────────┼──────────────────┤
│  C++ Runtime     │   Rust Runtime  │  Zig Runtime   │  C++ Browser     │
├──────────────────┼─────────────────┼────────────────┼──────────────────┤
│  libuv           │   tokio         │  Custom        │  Browser APIs    │
│  (event loop)    │   (async Rust)  │  (io_uring)    │  (OS-specific)   │
├──────────────────┼─────────────────┼────────────────┼──────────────────┤
│  libc            │   libc          │  libc/direct   │  Sandboxed       │
├──────────────────┼─────────────────┼────────────────┼──────────────────┤
│                            KERNEL (Linux/macOS/Windows)                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. JS Engine Comparison

### V8 (Node.js, Deno, Chrome)

| Aspect | Details |
|--------|---------|
| **Company** | Google |
| **JIT Tiers** | Ignition (interpreter) → Sparkplug → Maglev → TurboFan |
| **GC** | Generational, concurrent, incremental |
| **Isolates** | Multiple JS heaps in one process |
| **Memory** | Default 1.4GB limit (configurable) |
| **Debugging** | Chrome DevTools Protocol |

```bash
# V8 flags (Node)
node --v8-options | head -50
node --expose-gc script.js  # Manual GC
node --max-old-space-size=4096 script.js  # 4GB heap
```

### JSC (Bun, Safari)

| Aspect | Details |
|--------|---------|
| **Company** | Apple/WebKit |
| **JIT Tiers** | LLInt → Baseline → DFG → FTL (via B3) |
| **GC** | Generational, concurrent marking |
| **Isolates** | No equivalent (single heap) |
| **Memory** | System-limited |
| **Debugging** | Safari Web Inspector (limited) |

```bash
# JSC flags (Bun)
JSC_showDFGDisassembly=1 bun run script.js
JSC_dumpGraph=1 bun run script.js
```

### Comparison Table

| Feature | V8 | JSC |
|---------|----|----|
| String encoding | UTF-16 | UTF-16 (same) |
| Property access | Hidden classes | Structure transitions |
| Inline caching | Yes | Yes |
| Speculative optimization | TurboFan | DFG/FTL |
| Deoptimization | Bailout | OSR exit |
| Wasm support | Full | Full |
| Regexp | Irregexp | YARR |

### JIT Compilation Tiers

```
V8 Pipeline:
  Source → Ignition (bytecode) → [hot] → Sparkplug → [hotter] → Maglev → TurboFan
           ~1ms                         ~5ms           ~20ms      ~100ms

JSC Pipeline:
  Source → LLInt (bytecode) → [hot] → Baseline → [hotter] → DFG → FTL
           ~1ms                       ~5ms          ~30ms     ~150ms
```

---

## 3. Event Loop Comparison

### libuv (Node.js)

```c
// Pseudo-code libuv event loop
while (running) {
    uv__run_timers(loop);
    uv__run_pending(loop);
    uv__run_idle(loop);
    uv__run_prepare(loop);
    
    // BLOCKING: wait for I/O
    uv__io_poll(loop, timeout);  // epoll_wait / kevent
    
    uv__run_check(loop);
    uv__run_closing_handles(loop);
}
```

**Characteristics:**
- Cross-platform abstraction
- Thread pool for blocking operations (4 threads default)
- epoll (Linux), kqueue (macOS), IOCP (Windows)

### tokio (Deno)

```rust
// Pseudo-code tokio
#[tokio::main]
async fn main() {
    // Multi-threaded work-stealing runtime
    tokio::spawn(async { /* task */ });
}
```

**Characteristics:**
- Rust async/await
- Work-stealing scheduler
- mio underneath (epoll/kqueue/IOCP)

### Bun Event Loop

```zig
// Pseudo-code Bun (simplified)
while (running) {
    // io_uring for async I/O (Linux 5.1+)
    const cqe = io_uring_wait_cqe(&ring);
    
    // Process completions
    for (completions) |cqe| {
        handle_completion(cqe);
    }
    
    // Run JS microtasks
    runMicrotasks();
}
```

**Characteristics:**
- io_uring when available (Linux 5.1+)
- epoll fallback
- Single-threaded JS (like Node)
- Zig async (different from JS async)

### Syscall Comparison

```bash
# Node.js HTTP server
strace -c node server.js
# Typical: epoll_wait, read, write, mmap

# Bun HTTP server
strace -c bun server.js
# Typical: io_uring_enter, read, write (fewer syscalls)
```

| Operation | Node (libuv) | Bun (io_uring) |
|-----------|--------------|----------------|
| File read | epoll_wait + read | io_uring SQE (batched) |
| HTTP request | multiple syscalls | fewer syscalls |
| Timer | timerfd_create | timer in userspace |

---

## 4. Memory Model

### Node.js

```javascript
// V8 memory regions
// - New space (young generation): ~1-8MB
// - Old space: up to 1.4GB (default)
// - Large object space: >512KB objects
// - Code space: JIT-compiled code
// - Map space: hidden classes

process.memoryUsage();
// { rss, heapTotal, heapUsed, external, arrayBuffers }
```

### Bun

```javascript
// JSC memory (different structure)
// - Generational heap (eden, old)
// - MarkedBlock allocator
// - Subspace per type

Bun.gc(false);  // Sync GC
Bun.gc(true);   // Async hint
```

### Comparison

| Aspect | Node/V8 | Bun/JSC |
|--------|---------|---------|
| Default heap | 1.4GB | System-limited |
| GC pause | ~10-100ms | ~10-50ms |
| Incremental | Yes | Yes |
| Concurrent | Yes | Yes |
| Generational | Yes | Yes |
| Compaction | Yes | Limited |

---

## 5. FFI Comparison

### Node.js (N-API / node-ffi-napi)

```javascript
// N-API (stable ABI)
const addon = require('./build/Release/addon.node');
addon.hello();

// ffi-napi (dynamic)
const ffi = require('ffi-napi');
const libm = ffi.Library('libm', {
  'ceil': ['double', ['double']]
});
libm.ceil(1.5);  // 2
```

**Characteristics:**
- N-API: stable ABI across Node versions
- Requires native addon compilation
- Overhead: ~500ns per call (ffi-napi)

### Deno (FFI via dlopen)

```typescript
const lib = Deno.dlopen("./libexample.so", {
  add: { parameters: ["i32", "i32"], result: "i32" }
});
lib.symbols.add(1, 2);
```

**Characteristics:**
- Requires `--allow-ffi` flag
- Supports async calls
- Similar API to Bun

### Bun (bun:ffi)

```typescript
import { dlopen, FFIType, ptr, suffix } from "bun:ffi";

const lib = dlopen(`./libexample.${suffix}`, {
  add: {
    args: [FFIType.i32, FFIType.i32],
    returns: FFIType.i32,
  },
});

lib.symbols.add(1, 2);  // 3
```

**Characteristics:**
- No permission prompt (!)
- Direct syscalls possible
- Fastest FFI (~50ns per call)
- N-API compatibility layer

### Performance Comparison

| Runtime | FFI Call Overhead |
|---------|-------------------|
| Node (N-API native) | ~100ns |
| Node (ffi-napi) | ~500ns |
| Deno (dlopen) | ~150ns |
| Bun (bun:ffi) | ~50ns |
| Direct C | ~1ns |

---

## 6. libc Interaction

### What libc provides

```c
// Memory
malloc, free, realloc, calloc

// Strings
strlen, strcpy, strcmp, memcpy, memset

// I/O
open, read, write, close, fopen, fread

// Process
fork, exec, wait, exit

// Network
socket, bind, listen, accept, connect, send, recv

// Threads
pthread_create, pthread_join, pthread_mutex_*
```

### Node.js libc usage

```bash
# Ver dependencias dinamicas
ldd $(which node)
# linux-vdso.so.1
# libdl.so.2
# libstdc++.so.6
# libm.so.6
# libgcc_s.so.1
# libpthread.so.0
# libc.so.6
# ld-linux-x86-64.so.2
```

- Uses libc via V8 and libuv
- No direct syscall wrapper exposed

### Bun libc usage

```bash
ldd $(which bun)
# Similar dependencies but...
# Also links: libc.so.6, libm.so.6, libpthread.so.0
# Plus: JSC embedded
```

- Can bypass libc via Zig's syscall()
- `bun:ffi` allows direct libc calls

```typescript
// Direct libc via FFI
import { dlopen, FFIType, ptr } from "bun:ffi";

const libc = dlopen("libc.so.6", {
  getpid: { args: [], returns: FFIType.i32 },
  geteuid: { args: [], returns: FFIType.i32 },
  syscall: { args: [FFIType.i64, "..."], returns: FFIType.i64 },
});

console.log("PID:", libc.symbols.getpid());
console.log("EUID:", libc.symbols.geteuid());
```

### Syscalls: Wrapper vs Direct

| Approach | Example | Overhead |
|----------|---------|----------|
| Node fs.readFile | libc read() via libuv | ~1000 cycles |
| Bun file.text() | libc read() | ~500 cycles |
| Bun FFI syscall | direct syscall | ~100 cycles |
| C program | direct syscall | ~100 cycles |

```typescript
// Bun: raw syscall (Linux x86_64)
import { syscall } from "bun";

// read(fd, buf, count)
const SYS_read = 0;
const bytesRead = syscall(SYS_read, fd, bufPtr, 1024);
```

---

## 7. Security Model

### Browser (reference: maximum security)

```
┌─────────────────────────────────────┐
│           Renderer Process          │
│  ┌─────────────────────────────┐    │
│  │      JS Sandbox (V8)        │    │
│  │  - No filesystem            │    │
│  │  - No raw sockets           │    │
│  │  - No process spawn         │    │
│  │  - Origin-based             │    │
│  └─────────────────────────────┘    │
│  Seccomp-BPF filter                 │
│  Namespaces (user, net, pid)        │
└─────────────────────────────────────┘
        │ Mojo IPC
┌───────▼─────────────────────────────┐
│           Browser Process           │
│  - Mediates all system access       │
└─────────────────────────────────────┘
```

### Deno (permission model)

```
┌─────────────────────────────────────┐
│           Deno Process              │
│  ┌─────────────────────────────┐    │
│  │         V8 Isolate          │    │
│  └──────────────┬──────────────┘    │
│                 │                   │
│  ┌──────────────▼──────────────┐    │
│  │     Permission Layer        │    │
│  │  --allow-read=/tmp          │    │
│  │  --allow-net=example.com    │    │
│  │  --allow-env=HOME           │    │
│  └──────────────┬──────────────┘    │
│                 │                   │
│  ┌──────────────▼──────────────┐    │
│  │         Rust Runtime        │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### Node.js (experimental permissions)

```bash
# Experimental (Node 20+)
node --experimental-permission \
     --allow-fs-read=/tmp \
     --allow-fs-write=/tmp \
     script.js
```

**Reality:** Most Node code runs with full access.

### Bun (NO SANDBOX)

```
┌─────────────────────────────────────┐
│           Bun Process               │
│  ┌─────────────────────────────┐    │
│  │         JSC Engine          │    │
│  └──────────────┬──────────────┘    │
│                 │                   │
│  ┌──────────────▼──────────────┐    │
│  │       Zig Runtime           │    │
│  │   FULL SYSTEM ACCESS        │    │
│  │   - All filesystem          │    │
│  │   - All network             │    │
│  │   - Process spawn           │    │
│  │   - FFI (raw memory!)       │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### Comparison Matrix

| Capability | Browser | Deno | Node | Bun |
|------------|---------|------|------|-----|
| Read any file | No | --allow-read | Yes | Yes |
| Write any file | No | --allow-write | Yes | Yes |
| Network | CORS | --allow-net | Yes | Yes |
| Spawn process | No | --allow-run | Yes | Yes |
| Env vars | No | --allow-env | Yes | Yes |
| FFI | No | --allow-ffi | Yes | Yes |
| Raw syscalls | No | No | No | Yes |

---

## 8. TypeScript Support

### Node.js

```bash
# Requires transpilation
npx tsc index.ts
node index.js

# Or runtime transpilation
npx ts-node index.ts
npx tsx index.ts

# Native (Node 23+, experimental)
node --experimental-strip-types index.ts
```

### Deno

```bash
# Native (type checking + transpilation)
deno run index.ts

# Skip type checking
deno run --no-check index.ts
```

### Bun

```bash
# Native (transpilation only, no type checking)
bun run index.ts

# Type checking separate
bun tsc
```

### Comparison

| Aspect | Node | Deno | Bun |
|--------|------|------|-----|
| Native TS | No (exp) | Yes | Yes |
| Type check | External | Built-in | External |
| JSX/TSX | No | Yes | Yes |
| Source maps | Manual | Auto | Auto |
| Speed | tsc ~slow | ~100ms | ~10ms |

---

## 9. Package Management

### npm (Node)

```bash
npm install express
# Creates: node_modules/, package-lock.json
# Registry: registry.npmjs.org
```

### Deno

```typescript
// URL imports (no package manager)
import { serve } from "https://deno.land/std/http/server.ts";

// Or via npm specifier
import express from "npm:express@4";
```

### Bun

```bash
bun install express
# Creates: node_modules/, bun.lockb (binary!)
# Registry: registry.npmjs.org (same as npm)
```

### Comparison

| Aspect | npm | pnpm | Bun |
|--------|-----|------|-----|
| Lockfile | JSON | YAML | Binary |
| Speed | Baseline | 2-3x | 10-25x |
| Disk usage | High | Low (links) | Medium |
| Workspaces | Yes | Yes | Yes |
| Cache | ~/.npm | ~/.pnpm-store | ~/.bun/install/cache |

---

## 10. HTTP Server

### Node.js

```javascript
const http = require('http');
const server = http.createServer((req, res) => {
  res.end('Hello');
});
server.listen(3000);
```

Internals: libuv + http_parser (C)

### Deno

```typescript
Deno.serve({ port: 3000 }, (req) => {
  return new Response("Hello");
});
```

Internals: hyper (Rust)

### Bun

```typescript
Bun.serve({
  port: 3000,
  fetch(req) {
    return new Response("Hello");
  },
});
```

Internals: uWebSockets.js (C++)

### Benchmarks (requests/sec, single core)

| Runtime | Hello World | JSON | Realistic |
|---------|-------------|------|-----------|
| Node (http) | ~30k | ~25k | ~15k |
| Node (fastify) | ~50k | ~40k | ~25k |
| Deno (native) | ~80k | ~60k | ~40k |
| Bun (native) | ~150k | ~100k | ~60k |

*Note: Benchmarks vary wildly. Always test your use case.*

---

## 11. File System

### Node.js

```javascript
const fs = require('fs');

// Callback
fs.readFile('file.txt', (err, data) => {});

// Promise
const data = await fs.promises.readFile('file.txt');

// Sync
const data = fs.readFileSync('file.txt');
```

Internals: libuv → libc open/read/close

### Bun

```typescript
// Bun-specific (fastest)
const file = Bun.file('file.txt');
const text = await file.text();
const bytes = await file.arrayBuffer();

// Node compat
import { readFile } from 'fs/promises';
const data = await readFile('file.txt');
```

Internals: Zig → io_uring (Linux) or libc

### Comparison

| Operation | Node | Bun | Speedup |
|-----------|------|-----|---------|
| Read 1KB | 50μs | 10μs | 5x |
| Read 1MB | 5ms | 1ms | 5x |
| Write 1KB | 60μs | 15μs | 4x |
| Stat | 20μs | 5μs | 4x |

---

## 12. Build Tools

### Ecosystem

| Tool | Language | Use |
|------|----------|-----|
| tsc | TypeScript | Type checking |
| esbuild | Go | Bundling |
| swc | Rust | Transpilation |
| Rollup | JS | Bundling |
| Vite | JS | Dev server |
| Webpack | JS | Bundling (legacy) |

### Bun Built-in

```bash
# Transpile + bundle
bun build ./src/index.ts --outdir ./dist

# Minify
bun build ./src/index.ts --minify

# Target
bun build ./src/index.ts --target=browser
```

Internals: Parser + bundler written in Zig

### Speed Comparison

| Tool | 10 files | 1000 files |
|------|----------|------------|
| tsc | 2s | 30s |
| esbuild | 50ms | 500ms |
| swc | 30ms | 300ms |
| Bun | 20ms | 200ms |

---

## 13. WebSocket

### Node.js (ws package)

```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    ws.send(`Echo: ${data}`);
  });
});
```

### Bun (built-in)

```typescript
Bun.serve({
  fetch(req, server) {
    if (server.upgrade(req)) return;
    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    message(ws, msg) {
      ws.send(`Echo: ${msg}`);
    },
  },
});
```

Internals: uWebSockets.js

### Performance

| Metric | Node (ws) | Bun |
|--------|-----------|-----|
| Connections/core | ~10k | ~50k |
| Messages/sec | ~100k | ~500k |
| Memory/conn | ~50KB | ~10KB |

---

## 14. Summary Decision Matrix

| Use Case | Best Choice | Why |
|----------|-------------|-----|
| Production (stability) | Node.js | Mature, tested |
| Untrusted code | Deno | Permissions |
| Raw speed | Bun | Fastest |
| CLI tools | Bun | Startup time |
| Complex Node app | Node.js | Compatibility |
| New project | Bun/Deno | Modern APIs |
| FFI-heavy | Bun | Best FFI |
| Security-critical | Deno | Sandbox |
| Legacy | Node.js | Ecosystem |

---

## Cross-Reference

- `STUDY_PATH.md` all phases → use this as reference
- `runtime/03-jsc-integration` → JSC vs V8 deep dive
- `runtime/04-event-loop` → io_uring vs libuv
- `ffi/01-bun-ffi` → FFI comparison
- `security/02-sandbox` → security model implications
