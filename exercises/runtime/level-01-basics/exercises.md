# Runtime — Level 01: Basics (1 exercício)

## Ex 1.1 — Binary First Contact

### Objetivo
Analisar a estrutura básica do binário Bun.

### Skills
- readelf, objdump, file, checksec
- ELF headers interpretation

### Tarefa

1. Localize o binário Bun:
```bash
which bun
file $(which bun)
```

2. Analise os headers ELF:
```bash
readelf -h $(which bun)
```

3. Liste as sections:
```bash
readelf -S $(which bun) | head -30
```

4. Verifique security features:
```bash
checksec --file=$(which bun)
```

5. Extraia strings interessantes:
```bash
strings $(which bun) | grep -E "version|error|panic" | head -20
```

### Entrega

Documento com:
- [ ] Tipo de binário (ELF64, PIE, etc)
- [ ] Entry point address
- [ ] Sections principais (.text, .rodata, .data)
- [ ] Security features (RELRO, Canary, NX, PIE)
- [ ] 5 strings interessantes encontradas

### Verificação

```bash
# Deve mostrar ELF 64-bit, PIE
file $(which bun) | grep -q "ELF 64-bit" && echo "PASS" || echo "FAIL"

# Deve ter PIE habilitado
checksec --file=$(which bun) 2>/dev/null | grep -q "PIE.*enabled" && echo "PASS" || echo "FAIL"
```

### Tempo estimado
1 hora

### Próximo
→ Level 02: Syscall Tracing
