# Zig Runtime — Como Zig Estrutura o Codigo Bun

> Zig como linguagem de sistemas, build system, e como o runtime Bun e construido.

---

## Intuition (Feynman)

Zig e a linguagem que constroi o Bun. Imagine que voce quer construir uma casa: a maioria das linguagens te da tijolos pre-fabricados (garbage collector, runtime pesado). Zig te da acesso direto ao cimento e ferro. Voce decide TUDO — quando alocar memoria, quando liberar, como organizar.

O resultado: binario pequeno, sem GC overhead, controle total sobre execucao. E tambem: mais responsabilidade — sem GC, voce pode vazar memoria ou causar use-after-free.

---

## Source Code

No repositorio `oven-sh/bun`:
```
build.zig              # Build system principal
build.zig.zon          # Dependencias
src/
├── bun.zig            # Entry point do processo
├── main.zig           # CLI parsing e dispatch
├── global.zig         # Globals e inicializacao
├── runtime.zig        # Runtime principal
└── allocators/        # Allocators customizados
```

---

## Hands-On Analysis

### 1. Zig Build System

```bash
# Ver targets disponiveis
cat /path/to/bun/build.zig | grep "addExecutable\|addSharedLibrary" | head -20

# Compilar Bun (requer dependencias)
# zig build bun -Doptimize=ReleaseFast

# Ver opcoes de build
# zig build --help
```

### 2. Inspecionar Zig no Binario

```bash
# Zig deixa marcas no binario
strings $(which bun) | grep -i "zig" | head -10

# Panic handler do Zig
strings $(which bun) | grep -E "panic|unreachable|reached unreachable" | head -5

# Stack traces em debug builds
strings $(which bun) | grep -E "\.zig:" | head -20
```

### 3. Comptime e Generics

```zig
// Zig usa comptime para generics — diferente de C++ templates
fn Stack(comptime T: type) type {
    return struct {
        items: []T,
        len: usize,

        pub fn push(self: *@This(), item: T) void {
            self.items[self.len] = item;
            self.len += 1;
        }
    };
}

// Bun usa isso extensivamente para tipos de request, response, etc
const IntStack = Stack(i32);
const StringStack = Stack([]const u8);
```

### 4. Error Handling em Zig

```zig
// Zig: erros sao valores, nao excecoes
fn readFile(path: []const u8) ![]u8 {
    const file = try std.fs.openFileAbsolute(path, .{});
    defer file.close();
    return try file.readToEndAlloc(allocator, 1024 * 1024);
}

// Chamada:
const content = readFile("/etc/passwd") catch |err| {
    std.debug.print("Error: {}\n", .{err});
    return;
};
```

### 5. Undefined Behavior em Zig

```zig
// ReleaseSafe: checks mantidos
// ReleaseFast: checks removidos (undefined behavior nao checado)
// Debug: todos os checks

// Bun release usa ReleaseFast — mais rapido mas UB pode acontecer
const bun_build_mode = .ReleaseFast;
```

---

## Security Analysis

### Por que Zig importa para seguranca

```bash
# 1. Sem GC: sem pauses, mas memory leaks sao possiveis
# 2. Comptime: logica executada em compile-time pode ter bugs
# 3. @ptrCast: casting explicito, mas ainda perigoso
# 4. undefined: valores Zig undefined podem causar info leaks
```

### Zig vs C Security

| Feature | C | Zig |
|---------|---|-----|
| Null pointers | Silencioso | Optional types |
| Integer overflow | UB | Checked (debug) / UB (release) |
| Out of bounds | UB | Checked (debug) / UB (release) |
| Uninit memory | UB | `undefined` explicito |
| Memory leaks | Silencioso | Detectavel com GeneralPurposeAllocator |

### Comptime Attack Surface

```zig
// Codigo comptime roda no COMPILADOR, nao em runtime
// Bug em comptime = compilador vulneravel, nao o programa

comptime {
    // Isso roda quando Bun e compilado, nao quando executa
    const version = @import("version.zig");
    if (version.semver.major < 1) @compileError("Versao muito antiga");
}
```

---

## Exercises

### Ex 2.1 — Zig Fingerprinting

```bash
# 1. Identifique strings de erro Zig no binario
strings $(which bun) | grep -E "reached unreachable code|integer overflow|index out of bounds"

# 2. Compare com um binario C
strings /bin/ls | grep -c "error"
strings $(which bun) | grep -c "error"

# 3. O que a diferenca sugere?
```

### Ex 2.2 — Memory Model

```zig
// Escreva um programa Zig simples com leak intencional
// e use GeneralPurposeAllocator para detectar
const std = @import("std");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer {
        const leaked = gpa.deinit();
        if (leaked == .leak) std.debug.print("LEAK DETECTADO!\n", .{});
    }
    const allocator = gpa.allocator();

    // Aloca sem liberar
    const buf = try allocator.alloc(u8, 1024);
    _ = buf;  // Sem free = leak
}
```

### Ex 2.3 — Build Analysis

```bash
# Inspecione o build.zig.zon para dependencias
# No repositorio bun (se disponivel):
cat build.zig.zon 2>/dev/null || echo "Arquivo nao disponivel localmente"

# Quais dependencias o Bun tem?
# Busca publica:
# https://github.com/oven-sh/bun/blob/main/build.zig.zon
```

### Ex 2.4 — Panic Handler

```bash
# O que acontece quando Bun panica?
# 1. Crie um script que causa stack overflow
cat > /tmp/overflow.js << 'EOF'
function infinito() { return infinito() }
infinito()
EOF

# 2. Observe a saida de erro do Bun
bun /tmp/overflow.js 2>&1 | head -20

# 3. Compare com Node.js
node /tmp/overflow.js 2>&1 | head -20
```

---

## Checkpoint

[ ] Entende diferenca entre Zig comptime e runtime
[ ] Sabe que Zig nao tem GC
[ ] Identifica strings de panic Zig no binario
[ ] Entende ReleaseFast vs Debug builds
[ ] Sabe como GeneralPurposeAllocator detecta leaks

---

## Next

→ [`03-jsc-integration`](../03-jsc-integration/) — como JavaScriptCore e embedado no Bun
