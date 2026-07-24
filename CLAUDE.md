# CLAUDE.md — bunning

Lab de estudo profundo do Bun runtime com foco em seguranca e engenharia reversa.

## Objetivo

1. Entender Bun internals do binario ao syscall
2. Encontrar vulnerabilidades (zero-day research)
3. Criar harness otimizado para MAGO orchestration

## Estrutura

```
bunning/
├── README.md              # Overview
├── STUDY_PATH.md          # Trilha linear (8 fases)
├── HISTORY.md             # Origem e evolucao do Bun
├── COMPARATIVE.md         # vs Node/Deno/libc
├── INTERNALS_MAP.md       # Mapa do source code
├── CVE_INTEL.md           # Vulnerabilidades conhecidas
├── LAB_SETUP.md           # Ambiente de pesquisa
├── MAGO_HARNESS.md        # Harness para MAGO
├── PAPERS.md              # Referencias academicas
├── runtime/               # Modulos de runtime
├── memory/                # Subsistema de memoria
├── ffi/                   # Foreign function interface
├── http/                  # Networking stack
├── bundler/               # Parser e bundler
├── package/               # Package manager
├── security/              # Analise de seguranca
├── reverse/               # Reverse engineering
├── samples/               # Exemplos de codigo
├── exploits/              # PoCs (sandbox only)
└── exercises/             # 132 exercicios progressivos
```

## Agent Routing

- Modulos de runtime → pesquisa direta, nao delegar
- Security research → manter isolado, usar sandbox
- Exploit dev → apenas em ambiente controlado

## Conventions

- Documentacao em portugues (lab pessoal)
- Codigo em ingles (universal)
- Commits em ingles (OSS pattern)
- Findings documentados em formato CVE_INTEL

## Cross-Reference

Este lab conecta com:
- `~/lab/rusting/` — fundamentos Rust/seguranca
- `~/srv/mago/mago/` — board e harness destino
- `~/mago-vault/` — notas no Obsidian
