# Hooks — Instrumentacao via LD_PRELOAD e Function Hooking

> Como interceptar e modificar comportamento do Bun sem modificar o binario.

---

## Intuition (Feynman)

LD_PRELOAD e como colocar um interprete entre voce e uma pessoa: qualquer funcao que o programa chama passa pelo seu "interceptor" primeiro. Voce pode logging, modificar argumentos, ou mudar o comportamento completamente.

Para analise de seguranca: permite capturar chamadas de funcao (crypto, rede, arquivo) que de outra forma seriam invisíveis.

---

## Source Code

```
# Tecnicas:
# LD_PRELOAD     - substituir funcoes de biblioteca
# LD_DEBUG       - debug info de dynamic linker
# ptrace         - debugger API do kernel
# BPF uprobe     - eBPF em espaco de usuario
# Frida          - dynamic instrumentation framework
```

---

## Hands-On Analysis

### 1. LD_PRELOAD Basico

```c
// hook_open.c — intercepta chamadas a open()
#define _GNU_SOURCE
#include <stdio.h>
#include <dlfcn.h>
#include <stdarg.h>
#include <fcntl.h>

// Ponteiro para o open() original
static int (*real_open)(const char*, int, ...) = NULL;

// Nossa versao de open
int open(const char *pathname, int flags, ...) {
    // Carregar o open real na primeira chamada
    if (!real_open) {
        real_open = dlsym(RTLD_NEXT, "open");
    }

    // Log
    fprintf(stderr, "[HOOK] open(\"%s\", 0x%x)\n", pathname, flags);

    // Chamar o original
    if (flags & O_CREAT) {
        va_list args;
        va_start(args, flags);
        mode_t mode = va_arg(args, mode_t);
        va_end(args);
        return real_open(pathname, flags, mode);
    }
    return real_open(pathname, flags);
}
```

```bash
# Compilar
gcc -shared -fPIC -o /tmp/hook_open.so /tmp/hook_open.c -ldl

# Usar com Bun
LD_PRELOAD=/tmp/hook_open.so bun -e "
    await Bun.file('/etc/hostname').text()
" 2>&1 | grep "\[HOOK\]"
```

### 2. Hook de Funcoes de Rede

```c
// hook_network.c — intercepta connect()
#define _GNU_SOURCE
#include <stdio.h>
#include <dlfcn.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>

static int (*real_connect)(int, const struct sockaddr*, socklen_t) = NULL;

int connect(int sockfd, const struct sockaddr *addr, socklen_t addrlen) {
    if (!real_connect) real_connect = dlsym(RTLD_NEXT, "connect");

    if (addr->sa_family == AF_INET) {
        struct sockaddr_in *in = (struct sockaddr_in*)addr;
        fprintf(stderr, "[NET] connect() → %s:%d\n",
            inet_ntoa(in->sin_addr),
            ntohs(in->sin_port));
    }

    return real_connect(sockfd, addr, addrlen);
}
```

```bash
gcc -shared -fPIC -o /tmp/hook_net.so /tmp/hook_network.c -ldl

LD_PRELOAD=/tmp/hook_net.so bun -e "
    await fetch('https://example.com')
" 2>&1 | grep "\[NET\]"
```

### 3. Frida — Instrumentacao Dinamica

```bash
# Frida: framework profissional de instrumentacao
# pip3 install frida-tools

if command -v frida &>/dev/null; then
    echo "Frida disponivel"

    # Hookar funcao especifica
    cat > /tmp/frida_hook.js << 'EOF'
// Interceptar chamadas a open()
const openPtr = Module.getExportByName(null, 'open');
Interceptor.attach(openPtr, {
    onEnter(args) {
        const path = args[0].readUtf8String();
        if (path && !path.includes('/proc') && !path.includes('/dev')) {
            console.log(`[FRIDA] open("${path}")`);
        }
    }
});
console.log('[FRIDA] Hook instalado em open()');
EOF

    frida -f $(which bun) -l /tmp/frida_hook.js \
        --no-pause -- -e "await Bun.file('/etc/hostname').text()" 2>&1 | head -20
else
    echo "Frida nao disponivel: pip3 install frida-tools"
fi
```

---

## Security Analysis

### LD_PRELOAD como Vetor de Ataque

```bash
# LD_PRELOAD pode ser usado por malware para:
# 1. Interceptar funcoes de autenticacao
# 2. Capturar senhas antes de hashing
# 3. Modificar resultados de funcoes de seguranca

# Exemplo de rootkit simples:
cat > /tmp/evil_preload.c << 'EOF'
#define _GNU_SOURCE
#include <stdio.h>
#include <dlfcn.h>
#include <string.h>

// "Hook" de getuid — sempre retorna 0 (root)
uid_t getuid() {
    return 0;
}

uid_t geteuid() {
    return 0;
}
EOF

gcc -shared -fPIC -o /tmp/evil.so /tmp/evil_preload.c
echo "Sem hook: $(id)"
LD_PRELOAD=/tmp/evil.so id
# Vai mostrar uid=0 mas pode nao funcionar completamente por seguranca
```

### Detectar LD_PRELOAD

```bash
# Como detectar se LD_PRELOAD esta ativo

# 1. Verificar variavel de ambiente
echo "LD_PRELOAD: ${LD_PRELOAD:-nao definido}"

# 2. Verificar em /proc
cat /proc/$$/environ | tr '\0' '\n' | grep "LD_PRELOAD"

# 3. Verificar bibliotecas carregadas
cat /proc/$$/maps | grep "\.so" | awk '{print $6}' | sort -u | \
    while read lib; do
        # Verificar se a lib faz parte do sistema ou e suspeita
        if [ -f "$lib" ] && ! dpkg -S "$lib" &>/dev/null 2>/dev/null; then
            echo "[SUSPEITO] $lib"
        fi
    done
```

---

## Exercises

### Ex R3.1 — Crypto Hook

```c
// Interceptar funcoes de criptografia para capturar texto plano
// APENAS para fins educacionais e em sistemas proprios

// hook_crypto.c
#define _GNU_SOURCE
#include <stdio.h>
#include <dlfcn.h>
#include <openssl/evp.h>

// Interceptar EVP_DigestUpdate (hashing)
int EVP_DigestUpdate(EVP_MD_CTX *ctx, const void *d, size_t cnt) {
    static int (*real)(EVP_MD_CTX*, const void*, size_t) = NULL;
    if (!real) real = dlsym(RTLD_NEXT, "EVP_DigestUpdate");

    // Logar o dado sendo hashado (primeiro 32 bytes)
    if (cnt > 0 && cnt <= 1024) {
        fprintf(stderr, "[CRYPTO] DigestUpdate: %.*s\n", (int)cnt, (char*)d);
    }

    return real(ctx, d, cnt);
}
```

```bash
# Compilar (requer libssl-dev)
gcc -shared -fPIC -o /tmp/hook_crypto.so /tmp/hook_crypto.c \
    -ldl -lssl -lcrypto 2>/dev/null || echo "Requer libssl-dev"

# Usar
LD_PRELOAD=/tmp/hook_crypto.so bun -e "
    const crypto = await import('crypto');
    crypto.createHash('sha256').update('secret_password').digest('hex');
" 2>&1 | grep "\[CRYPTO\]"
```

### Ex R3.2 — LD_PRELOAD Detector

```typescript
// Verificar se o processo tem LD_PRELOAD ativo
function detectPreload(): string[] {
    const suspicious: string[] = [];

    // 1. Via variavel de ambiente
    const preload = Bun.env.LD_PRELOAD ?? Bun.env.LD_PRELOAD_64;
    if (preload) {
        suspicious.push(`LD_PRELOAD=${preload}`);
    }

    // 2. Via /proc (Linux)
    try {
        const { execSync } = Bun.spawn(["cat", "/proc/self/maps"]);
        // Analisar as libs carregadas
    } catch {}

    return suspicious;
}

const issues = detectPreload();
if (issues.length > 0) {
    console.warn("Ambiente suspeito detectado:", issues);
} else {
    console.log("Nenhum LD_PRELOAD detectado");
}
```

### Ex R3.3 — Function Call Logger

```c
// Logger generico de chamadas de funcao
// hook_logger.c

#define _GNU_SOURCE
#include <stdio.h>
#include <dlfcn.h>
#include <unistd.h>
#include <fcntl.h>

#define LOG(fmt, ...) fprintf(stderr, "[LOG] " fmt "\n", ##__VA_ARGS__)

// Interceptar read()
ssize_t read(int fd, void *buf, size_t count) {
    static ssize_t (*real)(int, void*, size_t) = NULL;
    if (!real) real = dlsym(RTLD_NEXT, "read");

    ssize_t ret = real(fd, buf, count);

    if (ret > 0 && fd > 2) { // ignorar stdin/stdout/stderr
        LOG("read(fd=%d, count=%zu) = %zd", fd, count, ret);
    }

    return ret;
}

// Interceptar write()
ssize_t write(int fd, const void *buf, size_t count) {
    static ssize_t (*real)(int, const void*, size_t) = NULL;
    if (!real) real = dlsym(RTLD_NEXT, "write");

    if (fd > 2) { // ignorar stdout/stderr
        LOG("write(fd=%d, count=%zu)", fd, count);
    }

    return real(fd, buf, count);
}
```

```bash
gcc -shared -fPIC -o /tmp/hook_logger.so /tmp/hook_logger.c -ldl
LD_PRELOAD=/tmp/hook_logger.so bun -e "
    await Bun.file('/etc/hostname').text()
" 2>&1 | head -10
```

---

## Checkpoint

[ ] Compilou e usou LD_PRELOAD para interceptar open()
[ ] Capturou conexoes de rede via hook de connect()
[ ] Entende LD_PRELOAD como vetor de ataque
[ ] Implementou detector de LD_PRELOAD
[ ] Sabe como Frida pode ser usado para instrumentacao dinamica

---

## Next

→ [`04-zig-specific`](../04-zig-specific/) — tecnicas de RE especificas para binarios Zig
