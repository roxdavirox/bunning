# Security — Level 01: Basics (1 exercício)

## Ex 1.1 — Attack Surface Mapping

### Objetivo
Mapear a superfície de ataque do Bun runtime.

### Skills
- Threat modeling
- Entry point identification
- Trust boundary analysis

### Tarefa

1. Identifique entry points:
```bash
# APIs que aceitam input externo
cat > /tmp/sec-lab/attack-surface.md << 'EOF'
# Bun Attack Surface

## Network Entry Points
- [ ] Bun.serve() - HTTP server
- [ ] fetch() - HTTP client
- [ ] WebSocket - bidirectional
- [ ] Bun.connect() - TCP/UDP

## File System Entry Points
- [ ] Bun.file() - file reading
- [ ] Bun.write() - file writing
- [ ] import/require - module loading

## Code Execution Entry Points
- [ ] eval() - direct code execution
- [ ] new Function() - dynamic functions
- [ ] bun:ffi - native code

## Package Manager Entry Points
- [ ] bun install - package installation
- [ ] postinstall scripts - arbitrary execution
- [ ] package.json - configuration

EOF
```

2. Analise cada entry point:
```bash
# Para cada entry point, responda:
# - Quem controla o input?
# - Qual o impacto se comprometido?
# - Existem validações?
```

3. Crie matriz de risco:
```bash
cat >> /tmp/sec-lab/attack-surface.md << 'EOF'

## Risk Matrix

| Entry Point | Input Source | Impact | Likelihood | Risk |
|-------------|--------------|--------|------------|------|
| FFI | Code | Critical | Low | High |
| postinstall | npm | Critical | Medium | Critical |
| Bun.serve | Network | Medium | High | High |
| fetch | Code | Medium | Low | Medium |
| eval | Code | Critical | Low | High |

EOF
```

### Entrega

Documento attack-surface.md com:
- [ ] Lista completa de entry points
- [ ] Classificação por categoria
- [ ] Matriz de risco
- [ ] Top 5 riscos priorizados
- [ ] Recomendações de mitigação

### Comparação

Compare com Node.js e Deno:
- [ ] Quais entry points Node tem que Bun não tem?
- [ ] O que Deno bloqueia que Bun permite?
- [ ] Quais mitigações Bun deveria adicionar?

### Verificação

```bash
# Verificar se FFI funciona sem restrição
bun -e "import{dlopen}from'bun:ffi';console.log('FFI:',!!dlopen)" 2>&1
# Se funciona sem erro = risco confirmado
```

### Tempo estimado
2 horas

### Próximo
→ Level 02: Sandbox Analysis
