# FFI — Level 01: Basics (1 exercício)

## Ex 1.1 — Hello FFI

### Objetivo
Carregar uma biblioteca C e chamar função via bun:ffi.

### Skills
- dlopen, FFIType
- C compilation
- Symbol resolution

### Tarefa

1. Crie biblioteca C simples:
```bash
mkdir -p /tmp/ffi-lab
cat > /tmp/ffi-lab/hello.c << 'EOF'
#include <stdio.h>

int add(int a, int b) {
    return a + b;
}

void greet(const char* name) {
    printf("Hello, %s!\n", name);
}

int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}
EOF
```

2. Compile como shared library:
```bash
gcc -shared -fPIC -o /tmp/ffi-lab/libhello.so /tmp/ffi-lab/hello.c
```

3. Crie script Bun para usar:
```bash
cat > /tmp/ffi-lab/test.ts << 'EOF'
import { dlopen, FFIType, suffix } from "bun:ffi";

const lib = dlopen("/tmp/ffi-lab/libhello.so", {
  add: {
    args: [FFIType.i32, FFIType.i32],
    returns: FFIType.i32,
  },
  greet: {
    args: [FFIType.cstring],
    returns: FFIType.void,
  },
  factorial: {
    args: [FFIType.i32],
    returns: FFIType.i32,
  },
});

console.log("2 + 3 =", lib.symbols.add(2, 3));
console.log("5! =", lib.symbols.factorial(5));
lib.symbols.greet("Bun FFI");
EOF
```

4. Execute:
```bash
bun run /tmp/ffi-lab/test.ts
```

### Entrega

- [ ] Código C compilado como .so
- [ ] Script Bun funcional
- [ ] Output correto: "2 + 3 = 5", "5! = 120", "Hello, Bun FFI!"
- [ ] Explicação de cada FFIType usado

### Verificação

```bash
cd /tmp/ffi-lab
bun run test.ts | grep -q "2 + 3 = 5" && echo "PASS" || echo "FAIL"
```

### Tempo estimado
1 hora

### Próximo
→ Level 02: libc Access
