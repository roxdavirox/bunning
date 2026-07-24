# Memory Safety — Tecnicas de Hardening e Deteccao

> Como detectar e prevenir bugs de memoria no ecossistema Bun/Zig.

---

## Intuition (Feynman)

Seguranca de memoria e como construir uma casa com proteções: alarmes nas janelas (checksec), paredes resistentes (RELRO, canaries), e sistemas de monitoramento (sanitizers). Mesmo com Zig (mais seguro que C), erros sao possiveis em `unsafe` blocks, chamadas C via FFI, e na fronteira com JSC.

A ideia nao e tornar bugs impossiveis, mas detecta-los cedo (em dev) e mitigar o impacto (em producao).

---

## Source Code

```
Ferramentas externas (nao no repo bun):
- AddressSanitizer (ASAN)
- MemorySanitizer (MSAN)
- UndefinedBehaviorSanitizer (UBSAN)
- Valgrind

Bun build com sanitizers:
zig build bun -Dsanitize-address
```

---

## Hands-On Analysis

### 1. AddressSanitizer

```bash
# ASAN detecta: heap-buffer-overflow, use-after-free, stack-buffer-overflow
# Requer build com ASAN (nao disponivel no binario oficial)

# Para codigo C proprio:
cat > /tmp/test_asan.c << 'EOF'
#include <stdlib.h>
#include <string.h>

int main() {
    char *buf = malloc(10);
    strcpy(buf, "Hello, World!"); // overflow!
    free(buf);
    return 0;
}
EOF

gcc -fsanitize=address -g -o /tmp/test_asan /tmp/test_asan.c
/tmp/test_asan 2>&1 | head -20
```

### 2. Zig Safety Modes

```zig
// Modos de compilacao e suas protecoes:

// Debug: TODAS as checagens ativas
// - Integer overflow detectado
// - Out-of-bounds detectado
// - Null pointer detectado
// - Unreachable detectado

// ReleaseSafe: checagens de runtime mantidas
// - Mais rapido que Debug
// - Ainda detecta erros comuns

// ReleaseFast: SEM checagens (undefined behavior)
// - Mais rapido
// - Erros silenciosos

// ReleaseSmall: minimo de codigo
// - Otimizado para tamanho

// Zig permite misturar por modulo!
pub fn safeCode(x: u8) u8 {
    return @addWithOverflow(x, 1).@"0"; // explicit overflow handling
}
```

### 3. Canary Stack Detection

```bash
# Verificar canary no binario Bun
checksec --file=$(which bun) | grep -i "canary\|stack"

# Como funciona:
# 1. Compilador insere valor aleatorio antes do return address
# 2. Antes de retornar, verifica se o valor mudou
# 3. Se mudou: alguem sobrescreveu a stack

# Demonstrar com codigo vulneravel
cat > /tmp/canary_demo.c << 'EOF'
#include <string.h>
void vulnerable(char *input) {
    char buf[16];
    strcpy(buf, input); // sem verificar tamanho
}
int main() {
    vulnerable("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"); // 35 bytes em buffer de 16
    return 0;
}
EOF
gcc -fstack-protector -o /tmp/canary_demo /tmp/canary_demo.c
/tmp/canary_demo 2>&1 # deve crashar com "stack smashing detected"
```

### 4. ASLR e PIE

```bash
# ASLR: kernel randomiza enderecos de memoria
cat /proc/sys/kernel/randomize_va_space
# 0 = desabilitado, 1 = parcial, 2 = completo

# PIE: binario pode ser carregado em qualquer endereco
file $(which bun) | grep -i "pie\|shared object"

# Ver enderecos diferentes a cada execucao
for i in 1 2 3; do
    bun -e "" &
    PID=$!
    sleep 0.1
    ADDR=$(grep "bun$" /proc/$PID/maps 2>/dev/null | head -1 | cut -d- -f1)
    echo "Execucao $i: base=$ADDR"
    kill $PID 2>/dev/null
done
```

---

## Security Analysis

### Mapa de Tecnicas de Mitigacao

| Tecnica | O que protege | Limita |
|---------|--------------|--------|
| Stack Canary | Stack overflow | Nao protege heap |
| NX/DEP | Shellcode na stack/heap | Nao impede ROP |
| ASLR + PIE | ROP gadget addresses | Precisa de info leak |
| Full RELRO | GOT overwrites | Overhead de startup |
| Fortify | Buffer functions | So funcoes especificas |
| ASAN | All memory bugs | 2x slowdown |

### Info Leak: Como ASLR Falha

```javascript
// Se temos um info leak, descobrimos o base address
// e podemos calcular todos os outros enderecos

// Em Bun: FFI expoe ponteiros
import { ptr } from "bun:ffi";

const buf = new Uint8Array(8);
const address = ptr(buf);
console.log(`Buffer esta em: 0x${address.toString(16)}`);

// Com esse endereco, sabemos a base de alocacoes do processo
// Isso pode ajudar a contornar ASLR para o heap
```

### Use-After-Free Pattern

```javascript
// UAF em JS e possivel via timing de GC + WeakRef

class VulnerableObject {
    constructor() {
        this.data = new ArrayBuffer(1024);
        this.view = new Uint8Array(this.data);
    }
}

// Padrao que pode causar problemas na fronteira JS/native:
// 1. JS object coletado pelo GC
// 2. Zig ainda tem ponteiro para os dados nativos
// 3. Novos objetos alocados no mesmo espaco
// 4. Leitura de dados "velhos" do objeto novo
```

---

## Exercises

### Ex M4.1 — checksec Audit

```bash
# Auditoria completa de features de seguranca
for bin in $(which bun) $(which node) /bin/bash /usr/sbin/nginx 2>/dev/null; do
    [ -f "$bin" ] || continue
    echo "=== $(basename $bin) ==="
    checksec --file=$bin 2>/dev/null || \
        python3 -c "
import subprocess, sys
r = subprocess.run(['readelf', '-h', sys.argv[1]], capture_output=True, text=True)
print(r.stdout[:200])
" $bin
    echo ""
done
```

### Ex M4.2 — ASLR Verification

```bash
# Verificar que enderecos mudam entre execucoes
echo "=== Enderecos do Bun (3 execucoes) ==="

for i in 1 2 3; do
    cat > /tmp/print_addr.js << 'EOF'
import { ptr } from "bun:ffi";
const buf = new Uint8Array(8);
console.log(`0x${ptr(buf).toString(16)}`);
EOF
    bun /tmp/print_addr.js 2>/dev/null
done

# Os enderecos devem ser diferentes (ASLR funcionando)
```

### Ex M4.3 — Sanitizer com Codigo Proprio

```c
// Crie uma biblioteca C com bug intencional e use ASAN
cat > /tmp/vuln_lib.c << 'EOF'
#include <stdlib.h>
#include <string.h>

// Buffer overflow intencional
void process(const char* input, size_t len) {
    char buf[32];
    memcpy(buf, input, len); // nao verifica tamanho!
}

// Use-after-free intencional
char* create_and_free() {
    char* p = malloc(16);
    strcpy(p, "secret");
    free(p);
    return p; // PERIGO: retorna ponteiro liberado
}
EOF

# Compilar com ASAN
gcc -shared -fPIC -fsanitize=address -g -o /tmp/vuln_lib.so /tmp/vuln_lib.c 2>&1

# Testar via Bun FFI (se ASAN estiver disponivel)
# ASAN detectara o problema e abortara com relatório detalhado
```

### Ex M4.4 — Memory Hardening Checklist

```bash
# Script de verificacao de hardening
cat > /tmp/hardening_check.sh << 'EOF'
#!/bin/bash
TARGET=$(which bun)
echo "Auditoria: $TARGET"
echo ""

# 1. PIE
if readelf -h $TARGET | grep -q "DYN"; then
    echo "[OK] PIE habilitado"
else
    echo "[FAIL] PIE desabilitado"
fi

# 2. NX
if readelf -l $TARGET | grep -q "GNU_STACK" && \
   readelf -l $TARGET | grep "GNU_STACK" | grep -q "RW "; then
    echo "[OK] NX habilitado (stack nao executavel)"
else
    echo "[WARN] Verificar NX manualmente"
fi

# 3. Stripped
if file $TARGET | grep -q "stripped"; then
    echo "[OK] Simbolos removidos (stripped)"
else
    echo "[INFO] Simbolos presentes (debug build?)"
fi

# 4. Fortify
if nm -D $TARGET 2>/dev/null | grep -q "__.*_chk"; then
    echo "[OK] Fortify presente"
else
    echo "[INFO] Fortify nao detectado"
fi
EOF
bash /tmp/hardening_check.sh
```

---

## Checkpoint

[ ] Executou checksec no binario Bun
[ ] Verificou ASLR com multiplas execucoes
[ ] Compilou codigo C com ASAN e detectou bug
[ ] Entende a tabela de mitigacoes e seus limites
[ ] Implementou checklist de hardening

---

## Next

→ [`../ffi/02-native-plugins`](../../ffi/02-native-plugins/) — plugins nativos via FFI
