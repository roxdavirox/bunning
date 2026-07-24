# CVE_INTEL — Bun Security Advisories & Vulnerabilities

> Indice de vulnerabilidades conhecidas + areas de pesquisa para zero-day hunting.
>
> Use para: Fase 8 do `STUDY_PATH.md`, reproducao de CVEs, e identificacao de patterns vulneraveis.

---

## CVEs Publicos

| CVE | Severity | Component | Description | Version | Fix Commit |
|-----|----------|-----------|-------------|---------|------------|
| CVE-2024-21490 | High | JSC | Type confusion in RegExp | < 1.0.23 | TBD |
| CVE-2024-29041 | Medium | HTTP | Header injection via CRLF | < 1.0.30 | TBD |
| CVE-2023-XXXXX | High | FFI | Arbitrary memory read | < 0.8.0 | TBD |

**Nota:** Bun e relativamente novo, CVEs publicos sao poucos. A maioria dos bugs e corrigida silenciosamente via commits.

---

## Security Advisories (GitHub)

Fonte: https://github.com/oven-sh/bun/security/advisories

| Date | Title | Severity | Component |
|------|-------|----------|-----------|
| 2024-XX | TBD | TBD | TBD |

---

## JSC Inherited Vulnerabilities

Bun usa JavaScriptCore. CVEs do WebKit/JSC podem afetar Bun:

| CVE | Year | Type | WebKit Affected | Bun Checked |
|-----|------|------|-----------------|-------------|
| CVE-2023-32435 | 2023 | Type confusion | Yes | TBD |
| CVE-2023-28205 | 2023 | UAF in DOM | Safari only | No (no DOM) |
| CVE-2022-32893 | 2022 | Out-of-bounds write | Yes | TBD |
| CVE-2022-22620 | 2022 | UAF | Yes | TBD |

**Metodologia:**
1. Listar CVEs JSC recentes
2. Verificar se componente afetado e usado por Bun
3. Tentar reproduzir em Bun
4. Se reproduz → reportar

---

## Areas de Zero-Day Research

### 1. Parser (ALTO POTENCIAL)

Bun tem parser JS/TS proprio em Zig. Nao e o parser do V8 ou JSC.

| Area | Risk | Why |
|------|------|-----|
| Unicode handling | High | Edge cases em normalization |
| RegExp | Critical | Historico de bugs em todos engines |
| Template literals | Medium | Nested parsing |
| BigInt | Medium | Overflow handling |
| Proxy/Reflect | High | Meta-programming edge cases |

**Fuzzing targets:**
```bash
# Corpus: edge cases unicode
echo -e '"\u{FFFE}"' | bun build --dump-ast -

# Corpus: deep nesting
python -c 'print("(".join(["x"]*10000) + ")")' | bun build --dump-ast -
```

### 2. FFI Boundaries (CRITICO)

FFI e o elo mais fraco. Qualquer bug aqui = arbitrary code execution.

| Area | Risk | Why |
|------|------|-----|
| Type marshalling | Critical | i64 overflow, pointer truncation |
| Callback handling | Critical | Use-after-free em closures |
| dlopen paths | High | Path traversal |
| Symbol resolution | Medium | Name confusion |

**Research questions:**
- O que acontece se passar struct com size errado?
- Callbacks sao protegidos contra racing?
- dlopen sanitiza paths?

### 3. Memory Allocator

mimalloc customizado:

| Area | Risk | Why |
|------|------|-----|
| Double free | Critical | Classic heap corruption |
| Integer overflow | High | Size calculations |
| Cross-thread | High | Race conditions |

### 4. HTTP Parser

uWebSockets.js em C++:

| Area | Risk | Why |
|------|------|-----|
| Chunked encoding | High | Off-by-one |
| Header parsing | Medium | Buffer overflow |
| WebSocket upgrade | High | State machine bugs |

### 5. Bundler

| Area | Risk | Why |
|------|------|-----|
| Import resolution | Medium | Path confusion |
| Source maps | Low | Information leak |
| Minification | Medium | Semantic changes |

---

## Commits Interessantes (Silent Fixes)

Buscar no historico por patterns:

```bash
git clone https://github.com/oven-sh/bun
cd bun

# Security-related keywords
git log --oneline --all --grep="security" | head -20
git log --oneline --all --grep="overflow" | head -20
git log --oneline --all --grep="bounds" | head -20
git log --oneline --all --grep="crash" | head -20
git log --oneline --all --grep="fix" --grep="null" | head -20

# Arquivos frequentemente tocados em fixes
git log --oneline --all -- "src/js_parser.zig" | head -20
git log --oneline --all -- "src/bun.zig" | head -20
```

---

## Responsible Disclosure

Bun aceita reports via:
- GitHub Security Advisories (preferido)
- Email: security@bun.sh

**Timeline tipico:**
- Report → Ack: 24-48h
- Fix development: 1-2 weeks
- Public disclosure: 90 days ou apos fix

---

## Bug Bounty

Ate o momento (2024), Bun **nao tem bug bounty formal**. Reconhecimento via:
- Credit no advisory
- Mencion no changelog

---

## Ferramentas de Hunting

| Tool | Purpose | Target |
|------|---------|--------|
| AFL++ | Coverage-guided fuzzing | Parser, HTTP |
| libFuzzer | In-process fuzzing | Individual functions |
| Frida | Dynamic instrumentation | Runtime analysis |
| ASan | Memory errors | All |
| UBSan | Undefined behavior | Zig code |
| Valgrind | Memory profiling | Heap analysis |

**Build com sanitizers:**
```bash
cd bun
zig build -Doptimize=ReleaseSafe -Dsanitize=address
zig build -Doptimize=ReleaseSafe -Dsanitize=undefined
```

---

## Workflow de Zero-Day Research

1. **Escolher componente** (parser, FFI, HTTP, etc)
2. **Ler source code** do componente
3. **Identificar patterns perigosos:**
   - Raw pointers
   - Integer arithmetic sem overflow check
   - Array access sem bounds check
   - Callbacks/closures
   - FFI calls
4. **Criar corpus de inputs:**
   - Edge cases
   - Malformed data
   - Large inputs
   - Unicode edge cases
5. **Fuzzing automatizado**
6. **Triagem de crashes:**
   - Reproducible?
   - Exploitable?
   - Security impact?
7. **Root cause analysis**
8. **PoC development**
9. **Responsible disclosure**

---

## Red Team Scenarios

### Scenario 1: Supply Chain Attack via Bun Package

```javascript
// malicious-package/package.json
{
  "scripts": {
    "postinstall": "bun run payload.js"
  }
}

// payload.js - uses FFI for stealth
import { dlopen, ptr } from "bun:ffi";
// ... exfiltrate data, establish C2
```

### Scenario 2: JSC JIT Spray

Se encontrar type confusion no JSC:
```javascript
// Craft payload que sobrevive JIT compilation
// Similar a browser exploits mas sem DOM
```

### Scenario 3: Parser DoS (ReDoS)

```javascript
// Regex catastrophica no parsing
const evil = "a".repeat(100) + "!";
new RegExp("(a+)+$").test(evil);
```

---

## Cross-Reference com STUDY_PATH

- `security/04-cve-analysis` → reproduzir CVEs desta lista
- `security/05-fuzzing` → usar ferramentas listadas
- `reverse/01-static` → analisar patches de seguranca
- `ffi/01-bun-ffi` → entender superficie de FFI para hunting
