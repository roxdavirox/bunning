# Runtime — Level 02: Basics Plus (1 exercício)

## Ex 2.1 — Syscall Tracing

### Objetivo
Traçar e entender os syscalls que Bun faz durante execução.

### Skills
- strace
- Syscall identification
- Process lifecycle

### Tarefa

1. Trace básico:
```bash
strace bun --version 2>&1 | head -30
```

2. Trace com estatísticas:
```bash
strace -c bun --version 2>&1
```

3. Trace de um script simples:
```bash
echo 'console.log("hello")' > /tmp/test.js
strace -f bun run /tmp/test.js 2>&1 | head -50
```

4. Filtrar syscalls específicos:
```bash
strace -e openat,read,write,mmap bun --version 2>&1
```

5. Compare com Node:
```bash
strace -c node --version 2>&1
strace -c bun --version 2>&1
```

### Entrega

Documento com:
- [ ] Lista dos 10 syscalls mais frequentes em `bun --version`
- [ ] Comparação de número de syscalls: Bun vs Node
- [ ] Identificação de syscalls de I/O (read, write, openat)
- [ ] Identificação de syscalls de memória (mmap, brk)
- [ ] Tempo total de execução (strace -T)

### Análise

Responda:
1. Quantos arquivos Bun abre durante `--version`?
2. Qual a primeira coisa que Bun faz após execve?
3. Bun usa io_uring ou epoll para I/O?

### Verificação

```bash
# Deve ter menos syscalls que Node
BUN_COUNT=$(strace -c bun --version 2>&1 | grep "^total" | awk '{print $4}')
NODE_COUNT=$(strace -c node --version 2>&1 | grep "^total" | awk '{print $4}')
[ "$BUN_COUNT" -lt "$NODE_COUNT" ] && echo "PASS: Bun mais eficiente" || echo "COMPARE: $BUN_COUNT vs $NODE_COUNT"
```

### Tempo estimado
1.5 horas

### Próximo
→ Level 03: Memory Mapping
