# PEER_BENCHMARK — Comparacao vs Outros Recursos

> Comparacao honesta deste lab vs outros recursos de estudo sobre Bun/runtimes.

---

## Recursos Oficiais

### Bun Documentation (bun.sh/docs)

| Aspecto | Oficial | Este Lab |
|---------|---------|----------|
| Foco | Uso, API | Internals, security |
| Profundidade | Surface | Deep (source code) |
| Security | Minimal | Extensive |
| Reverse eng | None | Complete track |
| Exercises | None | 132 progressive |

**Quando usar oficial:** Aprender a USAR Bun.
**Quando usar este lab:** Entender COMO funciona, encontrar bugs.

### Bun Discord/GitHub

- Discussions sobre bugs e features
- Nao ha material estruturado de internals
- Issues sao bom source de edge cases

---

## Cursos e Tutoriais

### Fireship / YouTube

| Aspecto | Videos | Este Lab |
|---------|--------|----------|
| Duracao | 10-30min | 234h |
| Profundidade | Overview | Deep dive |
| Hands-on | Demo | Exercises |
| Security | None | Core focus |

**Quando usar videos:** Introducao rapida.
**Quando usar este lab:** Estudo serio.

### Udemy/Coursera

- Nao existem cursos deep sobre Bun internals (2024)
- Cursos de Node.js nao cobrem JSC ou Zig

---

## Livros

### "Bun in Action" (hipotetico)

- Nao existe ainda (runtime muito novo)
- Livros de Node.js nao se aplicam a internals

### Relacionados

| Livro | Relevancia |
|-------|------------|
| "Node.js Design Patterns" | API patterns, nao internals |
| "V8 Internals" (blogs) | Engine diferente (V8 vs JSC) |
| "WebKit Architecture" | JSC source |
| "Practical Binary Analysis" | RE skills |

---

## Repositorios de Estudo

### nicolo-ribaudo/test262-parser-tests

- Testes de parser JavaScript
- Util para fuzzing corpus
- Nao foca em Bun especificamente

### nicolo-ribaudo/bun-lockb-parser

- Reverse do formato bun.lockb
- Inspiracao para modulo package/02-lockfile

### nicolo-ribaudo/test262-parser-tests

- ECMAScript conformance tests
- Bom para encontrar edge cases

---

## Este Lab vs Alternativas

| Feature | Este Lab | Docs Oficiais | Videos | Livros |
|---------|----------|---------------|--------|--------|
| Internals | Deep | None | Surface | None |
| Security | Core focus | Minimal | None | Some |
| Source code | Line by line | None | None | Some |
| FFI | Extensive | API only | None | None |
| Fuzzing | Track | None | None | Rare |
| Zero-day | Methodology | None | None | Rare |
| Exercises | 132 | None | Few | Some |
| MAGO integration | Yes | N/A | N/A | N/A |

---

## Gaps neste Lab

### O que NAO cobrimos bem (ainda)

1. **Windows internals** — Foco em Linux
2. **iOS/mobile** — Bun nao roda la
3. **Production deployment** — Foco e research
4. **Benchmarking methodology** — Parcial

### Roadmap

- [ ] Windows-specific analysis
- [ ] macOS/Darwin specifics
- [ ] More CVE reproductions
- [ ] Community contributions

---

## Recomendacao de Uso

### Para aprender a USAR Bun

1. Docs oficiais (bun.sh/docs)
2. Videos introdutorios
3. Exemplos no GitHub

### Para entender COMO funciona

1. **Este lab** (STUDY_PATH.md)
2. WebKit/JSC documentation
3. Zig language reference

### Para security research

1. **Este lab** (security track)
2. CVE_INTEL.md + reproducao
3. Fuzzing setup (LAB_SETUP.md)

### Para contribuir ao Bun

1. Entender internals (este lab)
2. Ler issues no GitHub
3. Submeter PRs

---

## Metricas de Qualidade

| Metrica | Rusting (modelo) | Este Lab |
|---------|------------------|----------|
| Arquivos MD | 25 | 14 |
| Linhas doc | ~15k | ~5k |
| Exercises | 165 | 132 |
| Horas estimadas | 300h | 234h |
| Tracks | 8 | 8 |
| Modulos detalhados | 20+ | 3 (inicial) |

**Status:** Lab inicial, estrutura pronta, modulos a expandir.
