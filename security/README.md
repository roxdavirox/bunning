# Security — Bun Security Analysis

> Attack surface, sandbox analysis, fuzzing, CVE research.

---

## Modulos

| # | Modulo | Topico | Horas |
|---|--------|--------|-------|
| 01 | [attack-surface](./01-attack-surface/) | Entry points, trust boundaries | 6h |
| 02 | [sandbox](./02-sandbox/) | What Bun doesn't have | 4h |
| 03 | [supply-chain](./03-supply-chain/) | Install scripts, typosquatting | 6h |
| 04 | [cve-analysis](./04-cve-analysis/) | Historical vulnerabilities | 8h |
| 05 | [fuzzing](./05-fuzzing/) | AFL++, corpus, crash triage | 10h |

---

## Attack Surface Summary

| Surface | Risk | Chapter |
|---------|------|---------|
| Parser | High | 01, 05 |
| FFI | Critical | 01 |
| Install hooks | Critical | 03 |
| JSC JIT | High | 04 |
| HTTP | Medium | 01 |

---

## Key Insight

**Bun has NO sandboxing.**

Unlike Deno (permissions) or browsers (origin), Bun runs with full user privileges. Any code (including npm packages) has:
- Full filesystem access
- Full network access
- FFI access (arbitrary memory)
- Process spawning

---

## Zero-Day Research Areas

1. **Parser** — Custom Zig parser, not battle-tested like V8
2. **FFI** — No bounds checking on memory operations
3. **JSC** — Inherited WebKit CVEs may apply
4. **HTTP** — uWebSockets.js C++ code

---

## Cross-Reference

- `CVE_INTEL.md` — known vulnerabilities
- `ffi/01-bun-ffi/` — FFI attack surface
- `LAB_SETUP.md` — fuzzing environment
