# Runtime — Level 03: Intermediate (2 exercícios)

## Ex 3.1 — Memory Layout Analysis

### Objetivo
Analisar o layout de memória de um processo Bun em execução.

### Skills
- /proc/[pid]/maps
- Memory regions identification
- Heap/stack analysis

### Tarefa

1. Inicie servidor Bun em background:
```bash
cat > /tmp/server.js << 'EOF'
Bun.serve({
  port: 3333,
  fetch(req) {
    return new Response("Hello");
  },
});
console.log("Server running on :3333");
EOF

bun run /tmp/server.js &
BUN_PID=$!
sleep 1
```

2. Analise memory maps:
```bash
cat /proc/$BUN_PID/maps
```

3. Identifique regiões:
```bash
cat /proc/$BUN_PID/maps | grep -E "\[heap\]|\[stack\]|\.so"
```

4. Verifique uso de memória:
```bash
cat /proc/$BUN_PID/status | grep -E "Vm|Rss"
```

5. Cleanup:
```bash
kill $BUN_PID
```

### Entrega

Diagrama de memória mostrando:
- [ ] Região de código (text)
- [ ] Heap (início e tamanho)
- [ ] Stack (localização)
- [ ] Bibliotecas carregadas (.so)
- [ ] Regiões anônimas (mmap)

---

## Ex 3.2 — Event Loop Observation

### Objetivo
Identificar qual mecanismo de I/O assíncrono Bun usa.

### Skills
- strace filtering
- io_uring vs epoll identification
- Async I/O patterns

### Tarefa

1. Trace I/O syscalls do servidor:
```bash
bun run /tmp/server.js &
BUN_PID=$!
sleep 1

strace -p $BUN_PID -e epoll_wait,epoll_ctl,io_uring_enter,io_uring_setup 2>&1 &
STRACE_PID=$!

# Fazer algumas requests
curl http://localhost:3333/
curl http://localhost:3333/
curl http://localhost:3333/

sleep 2
kill $STRACE_PID $BUN_PID 2>/dev/null
```

2. Verifique se usa io_uring:
```bash
strace -e io_uring_setup bun --version 2>&1 | grep io_uring
```

3. Compare com epoll:
```bash
strace -e epoll_create1,epoll_ctl bun --version 2>&1
```

### Entrega

Documento com:
- [ ] Mecanismo de I/O identificado (io_uring ou epoll)
- [ ] Versão do kernel (io_uring requer 5.1+)
- [ ] Syscalls observados durante request handling
- [ ] Diagrama do event loop

### Verificação

```bash
# Verificar versão do kernel
uname -r

# Se >= 5.1, Bun provavelmente usa io_uring
```

### Tempo estimado
3 horas total

### Próximo
→ Level 04: JSC Interaction
