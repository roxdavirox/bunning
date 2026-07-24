# Dynamic Analysis — Tracing e Runtime Analysis

> strace, ltrace, gdb, e como monitorar o Bun em execucao.

---

## Intuition (Feynman)

Analise dinamica e como espionar uma conversa: em vez de ler o roteiro (codigo), voce escuta o que o programa faz enquanto roda. Strace captura cada chamada ao kernel. Ltrace captura chamadas a bibliotecas. GDB permite pausar o programa em qualquer ponto e inspecionar seu estado.

---

## Source Code

```
# Ferramentas:
# strace   - tracing de syscalls
# ltrace   - tracing de chamadas de biblioteca
# gdb      - debugger
# perf     - performance profiling
# bpftrace - eBPF tracing (poderoso, requer root)
# dtrace   - tracing (macOS)
```

---

## Hands-On Analysis

### 1. strace — Syscall Tracing

```bash
# Syscalls durante startup
strace -c bun --version 2>&1

# Syscalls de uma operacao especifica
strace -e trace=openat,read,write,close \
    bun -e "await Bun.file('/etc/hostname').text()" 2>&1

# Tracing com timestamps e outputs
strace -tt -s 100 \
    bun -e "const r = await fetch('https://httpbin.org/get')" \
    2>&1 | grep -E "connect|send|recv" | head -20

# Filtrar por categoria
strace -e trace=network bun -e "await fetch('http://example.com')" 2>&1 | head -20
```

### 2. ltrace — Library Call Tracing

```bash
# Ver chamadas a libc e outras bibliotecas
ltrace -c bun --version 2>&1 | head -30

# Chamadas especificas
ltrace -e malloc,free,strlen,strcpy \
    bun -e "const x = 'hello'" 2>&1 | head -20
```

### 3. /proc Monitoring

```bash
# Monitorar um processo Bun rodando
cat > /tmp/long_running.js << 'EOF'
console.log("Rodando...");
setInterval(() => {}, 1000);
EOF

bun /tmp/long_running.js &
BUN_PID=$!

sleep 0.5

echo "=== Processos filhos ==="
pstree -p $BUN_PID

echo ""
echo "=== File descriptors ==="
ls -la /proc/$BUN_PID/fd/ | head -15

echo ""
echo "=== Mapas de memoria ==="
cat /proc/$BUN_PID/maps | grep -v "\.so" | head -10

echo ""
echo "=== Threads ==="
ls /proc/$BUN_PID/task/

kill $BUN_PID
```

### 4. GDB — Debugger

```bash
# GDB com Bun (build de debug recomendado)
# Bun release e stripped — simbolos limitados

# Iniciar Bun no GDB
gdb --args bun -e "console.log('test')"

# Comandos uteis dentro do GDB:
# (gdb) info functions                  # lista funcoes
# (gdb) break main                      # breakpoint em main
# (gdb) run                             # executar
# (gdb) backtrace                       # stack trace
# (gdb) info registers                  # registros
# (gdb) x/10wx $rsp                    # inspecionar stack
# (gdb) disassemble main               # disassembly

# Sem GDB interativo — capturar backtrace em crash
gdb -batch \
    -ex "run" \
    -ex "backtrace" \
    --args bun /tmp/crasher.js 2>&1 | head -30
```

---

## Security Analysis

### Monitorar Operacoes de Arquivo

```bash
# O que o Bun acessa quando executa um script?
cat > /tmp/track_files.sh << 'EOF'
#!/bin/bash
SCRIPT=${1:-"-e 'console.log(1)'"}

strace -e trace=openat -f \
    bash -c "bun $SCRIPT" 2>&1 | \
    grep 'openat' | \
    grep -v "ENOENT\|/proc\|/dev" | \
    sed 's/.*openat([^,]*,//; s/".*//' | \
    sort -u
EOF
bash /tmp/track_files.sh
```

### Network Monitoring

```bash
# Monitorar conexoes de rede do Bun
cat > /tmp/network_mon.sh << 'EOF'
#!/bin/bash
BUN_PID=""

# Iniciar com script que faz fetch
bun -e "await fetch('https://registry.npmjs.org/lodash')" &
BUN_PID=$!

# Monitorar conexoes em tempo real
for i in $(seq 1 5); do
    if [ -n "$BUN_PID" ] && [ -d "/proc/$BUN_PID" ]; then
        echo "=== t=${i}s: FDs de rede ==="
        ls -la /proc/$BUN_PID/fd 2>/dev/null | grep socket | head -5
    fi
    sleep 1
done

wait $BUN_PID
EOF
bash /tmp/network_mon.sh
```

### Heap Dump

```bash
# Capturar snapshot do heap em runtime (via /proc)
cat > /tmp/heap_dump.sh << 'EOF'
#!/bin/bash
bun -e "setInterval(() => {}, 9999)" &
PID=$!
sleep 0.5

echo "=== Heap segments de $PID ==="
grep "heap\|\[anon\]" /proc/$PID/smaps 2>/dev/null | head -30

echo ""
echo "=== Tamanho total do heap ==="
awk '/^Heap/{heap+=$2} /\[anon\]/{anon+=$2} END{print "Heap:", heap, "kB\nAnon:", anon, "kB"}' \
    /proc/$PID/smaps 2>/dev/null

kill $PID
EOF
bash /tmp/heap_dump.sh
```

---

## Exercises

### Ex R2.1 — Syscall Profile

```bash
# Perfil completo de syscalls de uma operacao
cat > /tmp/syscall_profile.sh << 'EOF'
#!/bin/bash
OPERATION=${1:-"import"}

case $OPERATION in
    "import")
        SCRIPT="import 'ms'"
        ;;
    "fetch")
        SCRIPT="await fetch('https://example.com')"
        ;;
    "file")
        SCRIPT="await Bun.file('/etc/hostname').text()"
        ;;
esac

echo "=== Syscall Profile: $OPERATION ==="
strace -c bun -e "$SCRIPT" 2>&1 | tail -20
EOF
bash /tmp/syscall_profile.sh file
```

### Ex R2.2 — Credential Leak Detection

```bash
# Verificar se variaveis de ambiente sensiveis aparecem nos processos
cat > /tmp/env_leak_check.sh << 'EOF'
#!/bin/bash
# Simular variavel sensivel
export SECRET_API_KEY="super_secret_key_12345"
export DATABASE_PASSWORD="db_pass_67890"

# Executar Bun e verificar se as vars aparecem em /proc
bun -e "setInterval(() => {}, 9999)" &
PID=$!
sleep 0.3

echo "=== Environment visivel em /proc/$PID/environ ==="
cat /proc/$PID/environ | tr '\0' '\n' | \
    grep -E "SECRET|PASSWORD|API_KEY|TOKEN" | head -10

echo ""
echo "=== Variaveis em maps? (strings em memoria) ==="
strings /proc/$PID/mem 2>/dev/null | grep "super_secret" | head -3 || \
    echo "(requer acesso privilegiado)"

kill $PID
unset SECRET_API_KEY DATABASE_PASSWORD
EOF
bash /tmp/env_leak_check.sh
```

### Ex R2.3 — eBPF Tracing

```bash
# bpftrace: tracing poderoso via eBPF (requer root)
if ! command -v bpftrace &>/dev/null; then
    echo "bpftrace nao disponivel. Instalar: apt install bpftrace"
    exit 0
fi

# Trace todas as syscalls do Bun
cat > /tmp/trace_bun.bt << 'EOF'
tracepoint:raw_syscalls:sys_enter
/comm == "bun"/
{
    printf("%s(%d)\n", ksym(args->id), pid);
}
EOF

echo "Iniciando trace (Ctrl+C para parar)..."
bun -e "await Bun.file('/etc/hostname').text(); console.log('done')" &
sudo bpftrace /tmp/trace_bun.bt 2>/dev/null | head -30
```

---

## Checkpoint

[ ] Usou strace para ver syscalls durante startup do Bun
[ ] Monitorou arquivos acessados durante execucao de script
[ ] Verificou variaveis de ambiente em /proc
[ ] Listou file descriptors de um processo Bun
[ ] Entende como GDB pode ser usado mesmo em binarios stripped

---

## Next

→ [`03-hooks`](../03-hooks/) — instrumentacao via LD_PRELOAD e hooks
