# INTERNALS_MAP — Mapa de Internals do Bun

> Navegacao pelo source code: onde cada feature vive, como se conectam.

---

## Repository Structure

```
oven-sh/bun/
├── .github/                    # CI/CD
├── build.zig                   # Main build file
├── src/
│   ├── bun.zig                 # Entry point
│   ├── main.zig                # Alternative entry
│   │
│   ├── allocator/              # Memory allocation
│   │   ├── allocator.zig
│   │   └── mimalloc/           # mimalloc fork
│   │
│   ├── async/                  # Async I/O
│   │   ├── io_uring.zig        # Linux io_uring
│   │   ├── kqueue.zig          # macOS kqueue
│   │   └── epoll.zig           # Linux epoll fallback
│   │
│   ├── bun.js/                 # Runtime APIs
│   │   ├── api/                # Bun.* APIs
│   │   ├── ffi.zig             # bun:ffi
│   │   ├── test/               # bun:test
│   │   └── node/               # Node.js compat
│   │
│   ├── bundler/                # Bundle/transpile
│   │   ├── bundler.zig
│   │   └── linker.zig
│   │
│   ├── css/                    # CSS parser
│   │
│   ├── http/                   # HTTP server/client
│   │   ├── server.zig          # Bun.serve
│   │   └── client.zig          # fetch
│   │
│   ├── install/                # Package manager
│   │   ├── install.zig
│   │   ├── lockfile.zig        # bun.lockb
│   │   └── registry.zig        # npm protocol
│   │
│   ├── js_parser.zig           # JS/TS parser
│   ├── js_lexer.zig            # Tokenizer
│   ├── js_ast.zig              # AST nodes
│   │
│   ├── resolver/               # Module resolution
│   │
│   ├── shell/                  # bun shell ($ syntax)
│   │
│   └── watcher/                # File watcher
│
├── packages/
│   └── bun-types/              # TypeScript definitions
│
└── test/                       # Test suite
```

---

## Entry Points

### Main Entry (`src/bun.zig`)

```zig
pub fn main() !void {
    // 1. Parse CLI args
    const args = parseArgs();
    
    // 2. Initialize runtime
    initRuntime();
    
    // 3. Route to subcommand
    switch (args.command) {
        .run => runScript(args),
        .install => installPackages(args),
        .build => bundle(args),
        .test => runTests(args),
        // ...
    }
}
```

### Script Execution Flow

```
CLI args
    │
    ▼
bun.zig:main()
    │
    ▼
runScript()
    │
    ├── resolver/ (find module)
    │       │
    │       ▼
    ├── js_parser.zig (parse)
    │       │
    │       ▼
    ├── bundler/ (if needed)
    │       │
    │       ▼
    └── JSC.evaluate() (execute)
            │
            ▼
        Event loop (io_uring/epoll/kqueue)
```

---

## Key Components Deep Dive

### 1. Parser (`src/js_parser.zig`)

```zig
// Simplified structure
pub const Parser = struct {
    source: Source,
    lexer: Lexer,
    allocator: Allocator,
    
    pub fn parse(self: *Parser) !AST {
        return self.parseProgram();
    }
    
    fn parseProgram(self: *Parser) !AST {
        while (!self.lexer.isEOF()) {
            const stmt = try self.parseStatement();
            // ...
        }
    }
    
    fn parseExpression(self: *Parser) !Expr {
        // Pratt parser (precedence climbing)
    }
};
```

**Security notes:**
- Depth limits: `MAX_NESTING_DEPTH`
- Unicode handling: UTF-8 → UTF-16 conversion
- RegExp: separate parser

### 2. FFI (`src/bun.js/ffi.zig`)

```zig
pub const FFI = struct {
    pub fn dlopen(path: []const u8, symbols: SymbolDef) !Library {
        const handle = std.c.dlopen(path, RTLD_NOW);
        // Load symbols from handle
    }
    
    pub fn call(func: *anyopaque, args: []Value) Value {
        // Marshal JS values → native
        // Call via function pointer
        // Marshal native → JS
    }
};
```

**Security notes:**
- NO path validation
- NO capability checks
- Direct memory access via `ptr`

### 3. HTTP Server (`src/http/server.zig`)

```zig
pub const Server = struct {
    uws_app: *uws.App,  // uWebSockets.js handle
    
    pub fn serve(config: Config) !*Server {
        // Initialize uWebSockets
        // Set up routes
        // Start listening
    }
    
    fn handleRequest(req: *Request, res: *Response) void {
        // Call user's fetch handler
        // Write response
    }
};
```

**Security notes:**
- uWebSockets.js in C++
- Header parsing limits
- Backpressure handling

### 4. Package Install (`src/install/install.zig`)

```zig
pub const Installer = struct {
    lockfile: Lockfile,
    registry: Registry,
    
    pub fn install(packages: []Package) !void {
        // 1. Resolve versions
        // 2. Download tarballs
        // 3. Extract to node_modules
        // 4. Run lifecycle scripts (!)
    }
    
    fn runLifecycleScript(script: []const u8) !void {
        // Spawns shell process
        // NO SANDBOX
    }
};
```

**Security notes:**
- postinstall runs with full permissions
- `--ignore-scripts` flag available

### 5. Event Loop (`src/async/`)

```zig
// Linux: io_uring preferred
pub const IoUring = struct {
    ring: linux.io_uring,
    
    pub fn submit(sqe: *SQE) void {
        // Submit to kernel
    }
    
    pub fn wait() []CQE {
        // Wait for completions
    }
};

// Fallback: epoll
pub const Epoll = struct {
    fd: i32,
    // ...
};
```

**Architecture:**
```
io_uring SQ (submission queue)
    │
    ▼ io_uring_enter()
    │
Kernel processes requests
    │
    ▼
io_uring CQ (completion queue)
    │
    ▼
Bun processes completions
    │
    ▼
Run JS callbacks
```

---

## JSC Integration

### Embedding

Bun embeds WebKit's JavaScriptCore:
- `src/deps/WebKit/` — WebKit submodule
- JSC headers in `src/jsc/`

### Key APIs

```zig
// Evaluate JS
const result = JSC.evaluate(source);

// Create JS objects
const obj = JSC.Object.create();
obj.set("key", JSC.Value.string("value"));

// Call JS function
const fn = global.get("myFunction");
const result = fn.call(global, args);
```

### GC Interaction

```zig
// Mark object as reachable
JSC.protect(obj);

// Allow GC to collect
JSC.unprotect(obj);

// Force GC (for testing)
JSC.gc.collectSync();
```

---

## Data Flow Diagrams

### fetch() Request

```
fetch(url)
    │
    ▼
src/http/client.zig
    │
    ├── DNS resolution (async)
    │       │
    │       ▼
    ├── TLS handshake (BoringSSL)
    │       │
    │       ▼
    ├── HTTP/1.1 or HTTP/2
    │       │
    │       ▼
    └── Response parsing
            │
            ▼
        JS Promise resolved
```

### bun install

```
bun install
    │
    ▼
Parse package.json
    │
    ▼
Read bun.lockb (if exists)
    │
    ▼
Resolve dependencies (registry.npmjs.org)
    │
    ▼
Download tarballs (parallel)
    │
    ▼
Extract to node_modules/
    │
    ▼
Run lifecycle scripts (⚠️)
    │
    ▼
Write bun.lockb
```

### bun build

```
bun build src/index.ts
    │
    ▼
Resolve entry point
    │
    ▼
Parse (js_parser.zig)
    │
    ▼
Build dependency graph
    │
    ▼
Tree shake (dead code elimination)
    │
    ▼
Minify (if --minify)
    │
    ▼
Write output bundle
```

---

## File → Feature Map

| File | Feature | Security Relevance |
|------|---------|-------------------|
| `bun.zig` | Entry | CLI parsing |
| `js_parser.zig` | Parser | Code injection |
| `ffi.zig` | FFI | CRITICAL |
| `install.zig` | Installer | Supply chain |
| `server.zig` | HTTP | Request smuggling |
| `client.zig` | fetch | SSRF |
| `io_uring.zig` | Async I/O | Performance |
| `allocator.zig` | Memory | Memory safety |

---

## Build System

### Zig Build

```bash
# Debug (symbols, slow)
zig build -Doptimize=Debug

# Release (stripped, fast)
zig build -Doptimize=ReleaseFast

# With sanitizers
zig build -Doptimize=ReleaseSafe -Dsanitize=address
```

### Dependencies

```zig
// build.zig (simplified)
const deps = [_]Dep{
    .{ .name = "mimalloc" },
    .{ .name = "boringssl" },
    .{ .name = "uwebsockets" },
    .{ .name = "webkit" },  // JSC
    .{ .name = "zlib" },
    .{ .name = "libuv" },   // Windows
};
```

---

## Exercises

### Ex 1 — Trace Script Execution

```bash
# 1. Clone Bun
git clone https://github.com/oven-sh/bun
cd bun

# 2. Find main entry
grep -n "pub fn main" src/bun.zig

# 3. Follow execution to JS evaluation
# Hint: look for JSC.evaluate
```

### Ex 2 — FFI Code Review

```bash
# 1. Read FFI implementation
cat src/bun.js/ffi.zig

# 2. Find where dlopen happens
grep -n "dlopen" src/bun.js/ffi.zig

# 3. Is there path validation?
```

### Ex 3 — Parser Limits

```bash
# 1. Find nesting limits
grep -rn "MAX.*DEPTH\|max.*depth" src/

# 2. What happens if exceeded?
```

---

## Checkpoint

[ ] Entender estrutura do repositorio
[ ] Saber onde cada feature vive
[ ] Conseguir navegar pelo source
[ ] Identificar pontos de seguranca

---

## Cross-Reference

- `STUDY_PATH.md` todas as fases → usar este mapa
- `runtime/` → dive em cada componente
- `security/` → analise de cada superficie
