# Allocator — Gerenciamento de Memoria no Bun

> Como Bun aloca, reutiliza e libera memoria usando allocators Zig customizados.

---

## Intuition (Feynman)

Um allocator e como um gerente de armazem: voce pede espaco ("preciso de 100 bytes"), ele encontra, reserva e te da o endereco. Quando voce termina, devolve o espaco ("pode reutilizar").

Zig nao tem GC — toda alocacao e explicita. Bun usa varios allocators para diferentes usos: um para objetos de vida longa, outro para temporarios de request, outro para strings. Cada um tem trade-offs de velocidade vs fragmentacao vs deteccao de bugs.

---

## Source Code

No repositorio `oven-sh/bun`:
```
src/
├── allocators/
│   ├── mimalloc.zig    # Interface para mimalloc
│   └── ...
├── memory.zig          # Gerenciamento central
└── global.zig          # Allocator global
```

---

## Hands-On Analysis

### 1. Tipos de Allocators em Zig

```zig
const std = @import("std");

// 1. GeneralPurposeAllocator — debug, detecta leaks e double-free
var gpa = std.heap.GeneralPurposeAllocator(.{}){};
const alloc1 = gpa.allocator();

// 2. ArenaAllocator — aloca muito, libera tudo de uma vez
var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
defer arena.deinit(); // libera tudo
const alloc2 = arena.allocator();

// 3. FixedBufferAllocator — aloca em buffer pre-alocado
var buffer: [4096]u8 = undefined;
var fba = std.heap.FixedBufferAllocator.init(&buffer);
const alloc3 = fba.allocator();

// 4. page_allocator — direto ao OS (mmap/VirtualAlloc)
const alloc4 = std.heap.page_allocator;
```

### 2. Bun usa mimalloc

```bash
# mimalloc e um allocator de alta performance da Microsoft
# Verificar se bun linkeia mimalloc
nm -D $(which bun) 2>/dev/null | grep -i "mimalloc\|mi_" | head -10

ldd $(which bun) 2>/dev/null | grep -i "mim"

# Alternativa: strings
strings $(which bun) | grep -i "mimalloc" | head -5
```

### 3. Memory Layout de um Processo Bun

```bash
# Ver mapa de memoria de um processo Bun em execucao
cat > /tmp/sleep_bun.js << 'EOF'
await new Promise(r => setTimeout(r, 30000));
EOF

bun /tmp/sleep_bun.js &
BUN_PID=$!

# Mapa de memoria
cat /proc/$BUN_PID/maps | head -40

# Resumo de memoria
cat /proc/$BUN_PID/status | grep -E "VmRSS|VmPeak|VmSize|VmHWM"

kill $BUN_PID
```

### 4. Heap Analysis

```bash
# Valgrind (se disponivel) para detectar leaks
# Bun nao funciona bem com valgrind por ser Zig/JSC

# Alternativa: heaptrack
# heaptrack bun script.js

# Metodo manual: /proc
cat > /tmp/memory_watch.sh << 'EOF'
#!/bin/bash
bun -e "setInterval(() => {}, 1000)" &
PID=$!

for i in $(seq 1 5); do
    RSS=$(cat /proc/$PID/status | grep VmRSS | awk '{print $2}')
    echo "t=${i}s: RSS=${RSS}kB"
    sleep 1
done

kill $PID
EOF
bash /tmp/memory_watch.sh
```

---

## Security Analysis

### Use-After-Free em Zig

```zig
// Sem GC, UAF e possivel
fn vulneravel(allocator: std.mem.Allocator) !void {
    const buf = try allocator.alloc(u8, 64);
    allocator.free(buf);

    // BUG: acesso apos free
    buf[0] = 0xFF;  // undefined behavior em release
    // Em debug: GeneralPurposeAllocator detecta isso
}
```

### Double-Free

```zig
fn doubleFree(allocator: std.mem.Allocator) !void {
    const buf = try allocator.alloc(u8, 64);
    allocator.free(buf);
    allocator.free(buf);  // CRASH ou corrupção de heap
}
```

### Heap Spray via JavaScript

```javascript
// Aloca muita memoria para aumentar chance de controlar o heap
// Tecnica classica para exploits de type confusion

const spray = [];
for (let i = 0; i < 10000; i++) {
    // Aloca buffers de tamanho especifico
    spray.push(new ArrayBuffer(1024));
}

// Em exploits reais, preenche com shellcode ou ROP gadgets
// Aqui apenas demonstra a tecnica
```

### mimalloc Security

```bash
# mimalloc tem protecoes contra heap attacks
# - Randomizacao de allocacoes
# - Deteccao de double-free
# - Heap isolation por thread

# Ver configuracoes de mimalloc
strings $(which bun) | grep -iE "MIMALLOC_|mi_option" | head -10

# Variaveis de ambiente de debug
MIMALLOC_VERBOSE=1 bun -e "const x = new Array(1000)" 2>&1 | head -20
```

---

## Exercises

### Ex M1.1 — Memory Footprint

```bash
# Meca o uso de memoria em diferentes cenarios
for script in \
    "console.log('hello')" \
    "const x = new Array(1000000).fill(0)" \
    "const x = Buffer.alloc(100 * 1024 * 1024)"; do

    echo "Script: $script"
    /usr/bin/time -v bun -e "$script" 2>&1 | grep "Maximum resident"
    echo "---"
done
```

### Ex M1.2 — Arena Pattern

```zig
// Implemente processamento de request usando arena allocator
// (libera toda memoria da request de uma vez)
const std = @import("std");

fn processRequest(parent_allocator: std.mem.Allocator, input: []const u8) ![]u8 {
    // Arena para toda memoria desta request
    var arena = std.heap.ArenaAllocator.init(parent_allocator);
    defer arena.deinit(); // libera TUDO quando a funcao retorna

    const allocator = arena.allocator();

    // Todas as alocacoes vao para a arena
    const upper = try std.ascii.allocUpperString(allocator, input);
    const prefixed = try std.fmt.allocPrint(allocator, "RESULT: {s}", .{upper});

    // Precisa copiar para fora da arena antes do deinit
    return try parent_allocator.dupe(u8, prefixed);
}
```

### Ex M1.3 — Heap Map Analysis

```bash
# Compare o heap layout de Bun e Node
# para o mesmo script
cat > /tmp/analyze_heap.sh << 'EOF'
#!/bin/bash
SCRIPT="setInterval(() => {}, 9999)"

for rt in bun node; do
    $rt -e "$SCRIPT" &
    PID=$!
    sleep 1

    echo "=== $rt (PID $PID) ==="
    # Contar regioes de memoria
    REGIONS=$(wc -l < /proc/$PID/maps)
    RSS=$(awk '/VmRSS/ {print $2}' /proc/$PID/status)

    echo "Regioes de memoria: $REGIONS"
    echo "RSS: ${RSS}kB"

    kill $PID
    echo ""
done
EOF
bash /tmp/analyze_heap.sh
```

---

## Checkpoint

[ ] Entende os 4 tipos de allocator Zig
[ ] Sabe que Bun usa mimalloc
[ ] Leu /proc/PID/maps de um processo Bun
[ ] Entende UAF e double-free em contexto sem GC
[ ] Implementou arena allocator simples

---

## Next

→ [`02-gc`](../02-gc/) — garbage collection do JSC e interacao com Zig
