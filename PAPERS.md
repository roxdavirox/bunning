# PAPERS — Academic References & Technical Docs

> Papers, RFCs, e documentacao tecnica para estudo profundo.

---

## Core Technology

### JavaScriptCore (JSC)

| Paper/Doc | Year | Topic | Relevance |
|-----------|------|-------|-----------|
| [WebKit Blog: Introducing the B3 JIT Compiler](https://webkit.org/blog/5852/) | 2016 | FTL JIT | JIT internals |
| [WebKit Blog: Speculation in JSC](https://webkit.org/blog/10308/) | 2020 | Speculation | Optimization |
| [JSC Architecture (WebKit Wiki)](https://github.com/nicolo-ribaudo/test262-parser-tests) | ongoing | Overview | Architecture |
| Removing Garbage Collection with No Regrets (Zakai 2011) | 2011 | Emscripten | GC patterns |

### Zig Language

| Paper/Doc | Year | Topic | Relevance |
|-----------|------|-------|-----------|
| [Zig Language Reference](https://ziglang.org/documentation/) | ongoing | Full spec | Language |
| [Zig comptime](https://zig.news/kristoff/comptime-zig-and-runtime-zig-b2c) | 2021 | Comptime | Meta-programming |
| Memory Safe C Programming (Ahmed 2020) | 2020 | Safety | Compare to Zig |

### Memory Allocators

| Paper/Doc | Year | Topic | Relevance |
|-----------|------|-------|-----------|
| [mimalloc: Free List Sharding in Action](https://www.microsoft.com/en-us/research/publication/mimalloc-free-list-sharding-in-action/) | 2019 | mimalloc | Bun's allocator |
| Scalable Memory Allocation (Berger 2000) | 2000 | Hoard | Multi-threading |
| TCMalloc: Thread-Caching Malloc | 2005 | tcmalloc | Comparison |
| jemalloc (Evans 2006) | 2006 | jemalloc | Alternative |

---

## Async I/O

### io_uring

| Paper/Doc | Year | Topic | Relevance |
|-----------|------|-------|-----------|
| [Efficient IO with io_uring](https://kernel.dk/io_uring.pdf) | 2019 | io_uring | Bun's I/O |
| [Lord of the io_uring](https://unixism.net/loti/) | 2020 | Tutorial | Deep dive |
| [liburing examples](https://github.com/axboe/liburing) | ongoing | Code | Implementation |

### Event Loops

| Paper/Doc | Year | Topic | Relevance |
|-----------|------|-------|-----------|
| [libuv Design Overview](http://docs.libuv.org/en/v1.x/design.html) | ongoing | libuv | Node comparison |
| The Secret Life of Event Loops (StrangeLoop) | 2016 | Patterns | Understanding |
| Scalable Event Multiplexing (Banga 1999) | 1999 | epoll history | Background |

---

## JavaScript Engines

### General

| Paper/Doc | Year | Topic | Relevance |
|-----------|------|-------|-----------|
| Just-In-Time Compilation (Aycock 2003) | 2003 | JIT | Theory |
| Trace-based JIT Compilation for Dynamic Languages (Gal 2009) | 2009 | Tracing JIT | SpiderMonkey |
| An Empirical Study of Real-World WebAssembly Binaries (Hilbig 2021) | 2021 | Wasm | Security |

### V8 (comparison)

| Paper/Doc | Year | Topic | Relevance |
|-----------|------|-------|-----------|
| [V8 Design](https://v8.dev/docs) | ongoing | Architecture | Compare JSC |
| Ignition: V8 Interpreter (Meurer 2016) | 2016 | Interpreter | Bytecode |
| TurboFan: A New JIT Compiler (Titzer 2016) | 2016 | Optimizing JIT | vs FTL |

---

## Security

### JIT Security

| Paper/Doc | Year | Topic | Relevance |
|-----------|------|-------|-----------|
| JIT Spraying and Mitigations (Blazakis 2010) | 2010 | JIT-ROP | Exploitation |
| [JIT Hardening](https://webkit.org/blog/10452/webgpu-progress-and-next-steps/) | 2020 | Mitigations | JSC hardening |
| The Geometry of Innocent Flesh on the Bone (Shacham 2007) | 2007 | ROP | Background |
| Control-Flow Integrity (Abadi 2005) | 2005 | CFI | Mitigation |

### Runtime Security

| Paper/Doc | Year | Topic | Relevance |
|-----------|------|-------|-----------|
| Spectre Attacks (Kocher 2018) | 2018 | Side-channel | SharedArrayBuffer |
| Small World with High Risks: A Study of Security Threats in npm (Zimmermann 2019) | 2019 | npm risks | Supply chain |
| Measuring the Security Impact of ESM (2023) | 2023 | ESM | Module isolation |

---

## HTTP & Networking

### HTTP/2 and HTTP/3

| Paper/Doc | Year | Topic | Relevance |
|-----------|------|-------|-----------|
| [RFC 7540 - HTTP/2](https://tools.ietf.org/html/rfc7540) | 2015 | HTTP/2 | Protocol |
| [RFC 9000 - QUIC](https://tools.ietf.org/html/rfc9000) | 2021 | QUIC | HTTP/3 basis |
| QUIC: A UDP-Based Secure and Reliable Transport (Langley 2017) | 2017 | QUIC | Design |

### TLS

| Paper/Doc | Year | Topic | Relevance |
|-----------|------|-------|-----------|
| [RFC 8446 - TLS 1.3](https://tools.ietf.org/html/rfc8446) | 2018 | TLS 1.3 | Security |
| [BoringSSL](https://boringssl.googlesource.com/boringssl/) | ongoing | Code | Bun's TLS |

### WebSocket

| Paper/Doc | Year | Topic | Relevance |
|-----------|------|-------|-----------|
| [RFC 6455 - WebSocket](https://tools.ietf.org/html/rfc6455) | 2011 | Protocol | Implementation |
| [uWebSockets](https://github.com/uNetworking/uWebSockets) | ongoing | Code | Bun's WS |

---

## Parsing & Compilation

### Parser Theory

| Paper/Doc | Year | Topic | Relevance |
|-----------|------|-------|-----------|
| Parsing Techniques (Grune 2008) | 2008 | Theory | Background |
| PEG Parsing in Less Space (Kuramitsu 2015) | 2015 | PEG | Alternative |
| Scannerless Parsing (Visser 1997) | 1997 | Scannerless | Theory |

### JavaScript Parsing

| Paper/Doc | Year | Topic | Relevance |
|-----------|------|-------|-----------|
| [ECMAScript Specification](https://tc39.es/ecma262/) | ongoing | JS spec | Authoritative |
| [Test262](https://github.com/nicolo-ribaudo/test262-parser-tests) | ongoing | Test suite | Conformance |
| Efficient Unicode Handling in Parsers (Pike 2003) | 2003 | Unicode | Edge cases |

---

## Package Management

### Ecosystem Analysis

| Paper/Doc | Year | Topic | Relevance |
|-----------|------|-------|-----------|
| Why npm Lockfiles Can Be a Security Risk (snyk 2021) | 2021 | Security | Lockfiles |
| A Measurement Study of the npm Registry (2021) | 2021 | npm | Ecosystem |
| Backstabber's Knife Collection: Breaking Builds with Code Attacks (Ohm 2020) | 2020 | Attacks | Supply chain |

---

## Reverse Engineering

### Binary Analysis

| Paper/Doc | Year | Topic | Relevance |
|-----------|------|-------|-----------|
| Reverse Engineering for Beginners (Yurichev) | ongoing | RE | Background |
| Practical Malware Analysis (Sikorski 2012) | 2012 | Analysis | Methodology |
| The IDA Pro Book (Eagle 2008) | 2008 | IDA | Tools |

### ELF Format

| Paper/Doc | Year | Topic | Relevance |
|-----------|------|-------|-----------|
| [ELF Specification](https://refspecs.linuxfoundation.org/elf/elf.pdf) | 1995 | ELF | Binary format |
| Learning Linux Binary Analysis (Andriesse 2016) | 2016 | Analysis | Techniques |

---

## Fuzzing

### Theory & Practice

| Paper/Doc | Year | Topic | Relevance |
|-----------|------|-------|-----------|
| AFL Whitepaper (Zalewski 2014) | 2014 | Coverage fuzzing | Methodology |
| [AFL++ Paper](https://www.usenix.org/system/files/woot20-paper-fioraldi.pdf) | 2020 | AFL++ | Tools |
| Evaluating Fuzz Testing (Klees 2018) | 2018 | Evaluation | Best practices |
| Fuzzing: Challenges, Reflections (Boehme 2020) | 2020 | State of art | Overview |

### Language-Specific

| Paper/Doc | Year | Topic | Relevance |
|-----------|------|-------|-----------|
| CodeAlchemist: Semantics-Aware Code Generation for Finding Bugs in JavaScript Engines (Han 2019) | 2019 | JS fuzzing | Engine bugs |
| DIE: Fuzzing JavaScript Engines (Park 2020) | 2020 | JS engines | Techniques |

---

## Reading Order by Phase

### Phase 0-1 (Setup + Binary)

1. ELF Specification
2. Zig Language Reference
3. Reverse Engineering for Beginners (cap 1-5)

### Phase 2 (Runtime)

1. JSC Architecture overview
2. B3 JIT blog post
3. mimalloc paper

### Phase 3 (Memory)

1. mimalloc paper (deep)
2. JSC GC blog posts
3. Spectre paper (SharedArrayBuffer)

### Phase 4 (FFI)

1. Zig extern/cImport docs
2. ELF dynamic linking
3. System V ABI

### Phase 5 (HTTP)

1. io_uring paper
2. RFC 6455 (WebSocket)
3. uWebSockets source

### Phase 6 (Bundler)

1. ECMAScript spec (parsing sections)
2. Test262 structure
3. Parsing Techniques (cap 3-4)

### Phase 7 (Package)

1. npm registry protocol
2. Small World with High Risks paper
3. Backstabber's Knife Collection

### Phase 8 (Security)

1. JIT Spraying paper
2. AFL whitepaper
3. CodeAlchemist paper (JS fuzzing)

---

## Where to Find

### Open Access

- arXiv.org (preprints)
- ACM Digital Library (some free)
- IEEE Xplore (some free)
- Usenix (all free)

### Tools Documentation

- https://ziglang.org/documentation/
- https://webkit.org/blog/
- https://v8.dev/docs
- https://kernel.dk/ (io_uring)

### Code Sources

- https://github.com/nicolo-ribaudo/test262-parser-tests
- https://github.com/nicolo-ribaudo/test262-parser-tests
- https://github.com/nicolo-ribaudo/test262-parser-tests
