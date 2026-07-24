# Bun:FFI — Foreign Function Interface

> dlopen, symbol resolution, calling conventions, direct syscalls.

---

## Intuition (Feynman)

FFI e como falar com estrangeiros: voce (JavaScript) quer chamar funcoes escritas em outra lingua (C, Zig, Rust).
Bun:FFI e o tradutor: ele carrega a biblioteca compartilhada (.so/.dll/.dylib), encontra a funcao pelo nome, e faz a traducao de tipos entre JS e native.

A diferenca crucial: **nao ha sandbox**. Quando voce chama FFI, esta rodando codigo nativo diretamente. E como dar as chaves do carro para o estrangeiro.

---

## Source Code

No repositorio `oven-sh/bun`:
```
src/
├── bun.js/
│   └── ffi.zig      # FFI implementation
├── js/
│   └── ffi.ts       # TS declarations
└── ...
```

---

## Basic Usage

### 1. Loading a Library

```typescript
import { dlopen, suffix, FFIType } from "bun:ffi";

// suffix: "so" (Linux), "dylib" (macOS), "dll" (Windows)
const lib = dlopen(`./libexample.${suffix}`, {
  add: {
    args: [FFIType.i32, FFIType.i32],
    returns: FFIType.i32,
  },
  greet: {
    args: [FFIType.cstring],
    returns: FFIType.void,
  },
});

// Chamar
const result = lib.symbols.add(40, 2); // 42
lib.symbols.greet("World");
```

### 2. Type System

```typescript
import { FFIType } from "bun:ffi";

// Primitives
FFIType.i8   FFIType.u8
FFIType.i16  FFIType.u16
FFIType.i32  FFIType.u32
FFIType.i64  FFIType.u64
FFIType.f32  FFIType.f64

// Pointers
FFIType.ptr       // void*
FFIType.cstring   // const char* (null-terminated)

// Special
FFIType.void
FFIType.bool
```

### 3. Pointers e Memory

```typescript
import { ptr, toBuffer, toArrayBuffer, CString } from "bun:ffi";

// Buffer -> pointer
const buf = new Uint8Array([1, 2, 3, 4]);
const pointer = ptr(buf);  // TypedArray -> native pointer

// Pointer -> Buffer (PERIGOSO: precisa saber o tamanho)
const data = toBuffer(pointer, 0, 100);  // offset, length

// CString
const cstr = new CString(pointer);
console.log(cstr.toString());
```

---

## Security Analysis

### Por que FFI e perigoso

```typescript
// 1. ARBITRARY MEMORY ACCESS
import { dlopen, ptr, FFIType } from "bun:ffi";

const libc = dlopen("libc.so.6", {
  memcpy: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
});

// Pode copiar qualquer memoria para qualquer lugar
// libc.symbols.memcpy(destPtr, srcPtr, size);
```

```typescript
// 2. ARBITRARY CODE EXECUTION
const libc = dlopen("libc.so.6", {
  system: {
    args: [FFIType.cstring],
    returns: FFIType.i32,
  },
});

libc.symbols.system("id");  // Executa comando
```

```typescript
// 3. DIRECT SYSCALLS
import { syscall } from "bun";

// execve("/bin/sh", NULL, NULL)
const SYS_execve = 59;  // Linux x86_64
// syscall(SYS_execve, pathPtr, 0, 0);
```

### Attack Vectors

| Vector | Impact | Mitigation |
|--------|--------|------------|
| Library loading | Code exec | Path validation |
| Memory read | Info leak | Capability check |
| Memory write | Code exec | Sandbox |
| Syscalls | Full control | No mitigation in Bun |

---

## Cross-Runtime Comparison

### Node.js (N-API)

```c
// addon.c
#include <node_api.h>

napi_value Add(napi_env env, napi_callback_info info) {
  // ... complex boilerplate
}

NAPI_MODULE_INIT() {
  // ... registration
}
```

```bash
# Requires native compilation
node-gyp build
```

- Pro: Stable ABI across Node versions
- Con: Compilation required, complex

### Node.js (ffi-napi)

```javascript
const ffi = require('ffi-napi');
const libm = ffi.Library('libm', {
  'ceil': ['double', ['double']]
});
libm.ceil(1.5);
```

- Pro: No compilation
- Con: Slow (~500ns overhead), dependency

### Deno (dlopen)

```typescript
const lib = Deno.dlopen("./lib.so", {
  add: { parameters: ["i32", "i32"], result: "i32" }
});
lib.symbols.add(1, 2);
```

- Pro: Similar API to Bun
- Con: Requires `--allow-ffi` flag

### Bun (bun:ffi)

```typescript
const lib = dlopen("./lib.so", {
  add: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 }
});
lib.symbols.add(1, 2);
```

- Pro: Fastest (~50ns), no compilation
- Con: **NO PERMISSION CHECK**

---

## Calling Conventions

### System V AMD64 ABI (Linux/macOS)

```
Arguments: rdi, rsi, rdx, rcx, r8, r9, then stack
Returns:   rax (integer), xmm0 (float)
Caller-saved: rax, rcx, rdx, rsi, rdi, r8-r11
Callee-saved: rbx, rbp, r12-r15
```

### Windows x64

```
Arguments: rcx, rdx, r8, r9, then stack
Returns:   rax (integer), xmm0 (float)
Shadow space: 32 bytes on stack (always)
```

### Example: What happens on FFI call

```typescript
lib.symbols.add(40, 2);

// 1. Bun marshals: JS Number -> i32
// 2. Loads symbol address from GOT
// 3. Sets up: mov edi, 40; mov esi, 2
// 4. call [symbol_address]
// 5. Reads rax, converts to JS Number
```

---

## Building Native Libraries

### C Library

```c
// example.c
int add(int a, int b) {
    return a + b;
}

void greet(const char* name) {
    printf("Hello, %s!\n", name);
}
```

```bash
gcc -shared -fPIC -o libexample.so example.c
```

### Zig Library

```zig
// example.zig
export fn add(a: i32, b: i32) i32 {
    return a + b;
}

export fn greet(name: [*:0]const u8) void {
    const stdout = std.io.getStdOut().writer();
    stdout.print("Hello, {s}!\n", .{name}) catch {};
}
```

```bash
zig build-lib example.zig -dynamic
```

### Rust Library

```rust
// lib.rs
#[no_mangle]
pub extern "C" fn add(a: i32, b: i32) -> i32 {
    a + b
}
```

```toml
# Cargo.toml
[lib]
crate-type = ["cdylib"]
```

---

## Advanced Patterns

### Callbacks

```typescript
import { callback, FFIType } from "bun:ffi";

// Create callback that native code can call
const myCallback = callback(
  { args: [FFIType.i32], returns: FFIType.i32 },
  (x) => x * 2
);

// Pass to native function
lib.symbols.register_callback(myCallback.ptr);

// IMPORTANT: callback must not be garbage collected while in use
```

### Structs (Manual)

```typescript
// C struct: { int x; int y; }
const struct = new Uint8Array(8);
const view = new DataView(struct.buffer);
view.setInt32(0, 10, true);  // x = 10 (little-endian)
view.setInt32(4, 20, true);  // y = 20

lib.symbols.process_point(ptr(struct));
```

### Direct Syscalls (Linux)

```typescript
import { syscall } from "bun";

// SYS_getpid = 39 (Linux x86_64)
const pid = syscall(39n);
console.log("PID:", pid);

// SYS_write = 1
const msg = new TextEncoder().encode("Hello from syscall\n");
syscall(1n, 1n, ptr(msg), BigInt(msg.length));
```

---

## Exercises

### Ex 4.1 — Hello FFI

```bash
# 1. Crie uma biblioteca C
cat > libhello.c << 'EOF'
#include <stdio.h>
void hello(const char* name) {
    printf("Hello, %s!\n", name);
}
EOF

gcc -shared -fPIC -o libhello.so libhello.c
```

```typescript
// 2. Chame de Bun
import { dlopen, FFIType } from "bun:ffi";

const lib = dlopen("./libhello.so", {
  hello: { args: [FFIType.cstring], returns: FFIType.void }
});

lib.symbols.hello("Bun");
```

### Ex 4.2 — libc Access

```typescript
// Acesse funcoes libc diretamente
import { dlopen, FFIType } from "bun:ffi";

const libc = dlopen("libc.so.6", {
  getpid: { args: [], returns: FFIType.i32 },
  getuid: { args: [], returns: FFIType.i32 },
  gethostname: { args: [FFIType.ptr, FFIType.u64], returns: FFIType.i32 },
});

console.log("PID:", libc.symbols.getpid());
console.log("UID:", libc.symbols.getuid());

// Bonus: get hostname
const buf = new Uint8Array(256);
libc.symbols.gethostname(ptr(buf), BigInt(buf.length));
console.log("Hostname:", new CString(ptr(buf)).toString());
```

### Ex 4.3 — Raw Syscall

```typescript
// Execute syscall diretamente (Linux only)
import { syscall, ptr } from "bun";

// uname syscall
const SYS_uname = 63n;
const utsbuf = new Uint8Array(390);  // sizeof(struct utsname)
const result = syscall(SYS_uname, ptr(utsbuf));

if (result === 0n) {
  // Parse sysname (primeiros 65 bytes)
  const sysname = new TextDecoder().decode(utsbuf.slice(0, 65)).replace(/\0/g, '');
  console.log("Sysname:", sysname);
}
```

### Ex 4.4 — Security Audit

```typescript
// Quao perigoso e FFI?

// 1. Consegue ler /etc/shadow?
import { dlopen, FFIType, ptr, CString } from "bun:ffi";

const libc = dlopen("libc.so.6", {
  fopen: { args: [FFIType.cstring, FFIType.cstring], returns: FFIType.ptr },
  fgets: { args: [FFIType.ptr, FFIType.i32, FFIType.ptr], returns: FFIType.ptr },
  fclose: { args: [FFIType.ptr], returns: FFIType.i32 },
});

const file = libc.symbols.fopen("/etc/passwd", "r");  // Try /etc/shadow
if (file) {
  const buf = new Uint8Array(1024);
  while (libc.symbols.fgets(ptr(buf), 1024, file)) {
    console.log(new CString(ptr(buf)).toString().trim());
  }
  libc.symbols.fclose(file);
}

// Resposta: SIM, FFI tem acesso total como o processo Bun
```

---

## Security Implications

### Capability Model (proposto)

```typescript
// O que Bun DEVERIA ter (mas nao tem)
const lib = dlopen("./lib.so", symbols, {
  capabilities: {
    memory: "restricted",  // Nao existe
    syscalls: false,       // Nao existe
    paths: ["/allowed/"]   // Nao existe
  }
});
```

### Mitigacoes Possiveis

1. **Nao usar bun:ffi com codigo untrusted**
2. **Sandboxing externo** (container, seccomp)
3. **Code review** de qualquer uso de FFI
4. **Allowlist de bibliotecas**

---

## Checkpoint

[ ] Carregar biblioteca C via dlopen
[ ] Chamar funcao com argumentos e retorno
[ ] Acessar libc.so.6 diretamente
[ ] Executar syscall raw
[ ] Entender implicacoes de seguranca

---

## Next

→ [`04-syscalls`](../04-syscalls/) — interface de syscalls diretas
