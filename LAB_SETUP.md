# LAB_SETUP — Ambiente de Pesquisa e Debug

> Setup completo para reverse engineering, fuzzing, e exploit development.

---

## Requisitos Minimos

| Component | Spec |
|-----------|------|
| RAM | 16GB (32GB recomendado para fuzzing) |
| Disk | 50GB livres |
| OS | Linux (Ubuntu 22.04+, Arch, NixOS) |
| Zig | 0.13.0+ (compativel com Bun) |

---

## 1. Binarios do Bun

### Release Build (producao)

```bash
# Via installer
curl -fsSL https://bun.sh/install | bash

# Verificar
which bun
bun --version
file $(which bun)
checksec --file=$(which bun)
```

### Debug Build (com simbolos)

```bash
# Clone
git clone https://github.com/oven-sh/bun
cd bun

# Dependencias
./scripts/bootstrap.sh

# Build debug (lento, ~30min)
zig build -Doptimize=Debug

# Resultado
ls -la zig-out/bin/bun
file zig-out/bin/bun
```

### ASAN Build (memory errors)

```bash
cd bun
zig build -Doptimize=ReleaseSafe -Dsanitize=address

# Testar
ASAN_OPTIONS=detect_leaks=1 ./zig-out/bin/bun --version
```

### UBSAN Build (undefined behavior)

```bash
zig build -Doptimize=ReleaseSafe -Dsanitize=undefined
```

---

## 2. Tools de Analise

### Static Analysis

```bash
# Basico (ja instalado na VPS)
sudo apt install binutils

# Avancado
sudo apt install radare2
# ou
curl -Ls https://github.com/radareorg/radare2/releases/download/5.8.8/radare2_5.8.8_amd64.deb -o r2.deb
sudo dpkg -i r2.deb

# Ghidra (GUI, para desktop)
# Download: https://ghidra-sre.org/
```

### Dynamic Analysis

```bash
# Tracing
sudo apt install strace ltrace

# Debugging
sudo apt install gdb
# ou lldb para mac

# GDB plugins
git clone https://github.com/pwndbg/pwndbg
cd pwndbg && ./setup.sh
```

### Instrumentacao

```bash
# Frida
pip install frida-tools

# Verificar
frida --version
frida-trace -i "open*" bun --version
```

### Fuzzing

```bash
# AFL++
sudo apt install afl++

# ou build from source
git clone https://github.com/AFLplusplus/AFLplusplus
cd AFLplusplus && make && sudo make install

# libFuzzer (via LLVM)
sudo apt install clang llvm
```

---

## 3. Corpus de Fuzzing

### Parser Corpus

```bash
mkdir -p corpus/parser

# JavaScript edge cases
cat > corpus/parser/unicode.js << 'EOF'
"\u{FFFE}"
"\u{10FFFF}"
"𝒜𝒷𝒸"
EOF

# Deep nesting
python3 -c 'print("(".join(["x"]*1000) + ")")' > corpus/parser/deep.js

# Template literals
cat > corpus/parser/template.js << 'EOF'
`${`${`nested`}`}`
`\u{61}`
`${"${x}"}`
EOF

# BigInt
cat > corpus/parser/bigint.js << 'EOF'
9007199254740991n
0xFFFFFFFFFFFFFFFFn
EOF
```

### HTTP Corpus

```bash
mkdir -p corpus/http

# Malformed headers
cat > corpus/http/crlf.txt << 'EOF'
GET / HTTP/1.1
Host: localhost
X-Injected: value\r\n\r\nGET /admin HTTP/1.1

EOF

# Chunked
cat > corpus/http/chunked.txt << 'EOF'
POST / HTTP/1.1
Transfer-Encoding: chunked

5
Hello
0

EOF
```

### FFI Corpus

```bash
mkdir -p corpus/ffi

# Type confusion inputs
cat > corpus/ffi/overflow.js << 'EOF'
import { ptr } from "bun:ffi";
const huge = new ArrayBuffer(0xFFFFFFFF);
EOF
```

---

## 4. Scripts de Analise

### Tracing Completo

```bash
#!/bin/bash
# trace-bun.sh

OUTPUT_DIR="traces/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUTPUT_DIR"

# Syscalls
strace -f -o "$OUTPUT_DIR/strace.log" bun "$@" 2>&1

# Library calls
ltrace -f -o "$OUTPUT_DIR/ltrace.log" bun "$@" 2>&1

# Summary
echo "Traces saved to $OUTPUT_DIR"
grep -c "^" "$OUTPUT_DIR/strace.log" | xargs echo "Syscalls:"
```

### Memory Map Snapshot

```bash
#!/bin/bash
# memmap.sh

PID=$(pgrep -n bun)
if [ -z "$PID" ]; then
  echo "Bun not running"
  exit 1
fi

cat /proc/$PID/maps > "memmap-$PID.txt"
cat /proc/$PID/smaps_rollup >> "memmap-$PID.txt"
echo "Saved to memmap-$PID.txt"
```

### Checksec Analysis

```bash
#!/bin/bash
# security-check.sh

BUN=$(which bun)

echo "=== Binary Security ==="
checksec --file="$BUN"

echo ""
echo "=== RELRO ==="
readelf -l "$BUN" | grep GNU_RELRO

echo ""
echo "=== Stack Canary ==="
readelf -s "$BUN" | grep stack_chk

echo ""
echo "=== Fortify ==="
readelf -s "$BUN" | grep FORTIFY
```

---

## 5. Ambiente Isolado

### Container para Fuzzing

```dockerfile
# Dockerfile.fuzz
FROM ubuntu:22.04

RUN apt update && apt install -y \
    build-essential \
    afl++ \
    clang \
    llvm \
    curl \
    git \
    strace

# Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Workspace
WORKDIR /fuzz
COPY corpus/ corpus/

CMD ["/bin/bash"]
```

```bash
docker build -t bun-fuzz -f Dockerfile.fuzz .
docker run -it --cap-add=SYS_PTRACE bun-fuzz
```

### VM para Exploit Dev

```bash
# Vagrant (opcional, para isolamento total)
vagrant init ubuntu/jammy64
vagrant up
vagrant ssh
```

---

## 6. Datasets

### Samples Conhecidos

| Source | Content | Use |
|--------|---------|-----|
| [Test262](https://github.com/tc39/test262) | ECMAScript tests | Conformance |
| [WebKit Tests](https://github.com/nicolo-ribaudo/test262-parser-tests) | JSC parser tests | Edge cases |
| [node-test-commitfest](https://github.com/nicolo-ribaudo/test262-parser-tests) | Node compat tests | Regression |

```bash
# Test262 (canonical JS tests)
git clone https://github.com/nicolo-ribaudo/test262-parser-tests corpus/test262
```

### CVE PoCs

```bash
mkdir -p exploits/cve

# Organizado por CVE
# exploits/cve/2024-XXXXX/poc.js
# exploits/cve/2024-XXXXX/README.md
```

---

## 7. Integracao com IDE

### Neovim (via DAP)

```lua
-- ~/.config/nvim/lua/dap-bun.lua
local dap = require("dap")

dap.adapters.bun = {
  type = "executable",
  command = "bun",
  args = { "inspect", "--break" },
}

dap.configurations.javascript = {
  {
    type = "bun",
    request = "launch",
    name = "Debug Bun",
    program = "${file}",
  },
}
```

### VS Code

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "bun",
      "request": "launch",
      "name": "Debug Bun",
      "program": "${file}"
    }
  ]
}
```

---

## 8. Quick Start

```bash
# 1. Clone este repo
cd ~/lab/bunning

# 2. Instalar Bun
curl -fsSL https://bun.sh/install | bash

# 3. Verificar setup
./scripts/verify-setup.sh

# 4. Primeiro trace
strace bun --version 2>&1 | head -20

# 5. Primeiro checksec
checksec --file=$(which bun)

# 6. Primeiro fuzz (smoke test)
mkdir -p findings
echo 'console.log(1)' > corpus/parser/simple.js
afl-fuzz -i corpus/parser -o findings -t 1000 -- bun build @@
```

---

## 9. Troubleshooting

### ASAN slow

```bash
# Desabilitar leak detection se muito lento
ASAN_OPTIONS=detect_leaks=0 ./bun-asan script.js
```

### Frida nao conecta

```bash
# Verificar ptrace
cat /proc/sys/kernel/yama/ptrace_scope
# Se 1, mudar para 0:
echo 0 | sudo tee /proc/sys/kernel/yama/ptrace_scope
```

### GDB symbols missing

```bash
# Build com debug symbols
zig build -Doptimize=Debug -Dstrip=false
```

---

## Cross-Reference

- `STUDY_PATH.md` Fase 0 → setup inicial
- `CVE_INTEL.md` → PoCs a reproduzir
- `reverse/` → metodologias de analise
- `security/05-fuzzing/` → fuzzing avancado
