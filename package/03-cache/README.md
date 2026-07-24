# Cache — Sistema de Cache Global do Bun

> Como o cache do Bun funciona, onde fica, e riscos de cache poisoning.

---

## Intuition (Feynman)

O cache do Bun e como um deposito pessoal de pacotes: na primeira vez que voce baixa `react@18`, ele fica guardado em `~/.bun/install/cache/`. Na proxima vez, seja em qualquer projeto, ele usa o cache em vez de baixar novamente.

Isso e fantasticamente rapido. Mas o deposito e compartilhado entre todos os projetos e usuarios — o que cria riscos: um pacote corrompido no cache afeta todos os projetos que o usam.

---

## Source Code

No repositorio `oven-sh/bun`:
```
src/
├── install/
│   ├── install.zig         # Logica de cache
│   └── cache.zig           # Gerenciamento do cache
└── ...
```

---

## Hands-On Analysis

### 1. Estrutura do Cache

```bash
# Localizar o cache
CACHE_DIR=$(bun pm cache 2>/dev/null || echo "$HOME/.bun/install/cache")
echo "Cache em: $CACHE_DIR"

# Ver o que esta no cache
ls "$CACHE_DIR" | head -20
du -sh "$CACHE_DIR"

# Estrutura de um pacote no cache
ls "$CACHE_DIR/react/" 2>/dev/null | head -5
# tipicamente: <package>@<version>.tgz ou extraido
```

### 2. Como o Cache e Usado

```bash
# Primeira instalacao (sem cache)
time bun add lodash 2>/dev/null

# Remover e reinstalar (com cache)
rm -rf node_modules bun.lockb
time bun add lodash 2>/dev/null

# A segunda e muito mais rapida — usa o cache
```

### 3. Inspecionar Conteudo Cacheado

```bash
CACHE_DIR="$HOME/.bun/install/cache"

# Ver arquivos de um pacote cacheado
find "$CACHE_DIR" -name "*.json" | head -5 | while read f; do
    echo "=== $f ==="
    cat "$f" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('version', '?'), d.get('name', '?'))" 2>/dev/null
done

# Verificar hashes
find "$CACHE_DIR" -name "*.sha512" 2>/dev/null | head -5
```

---

## Security Analysis

### Cache Poisoning

```bash
# Ataque: modificar pacote no cache para afetar todos os projetos

CACHE_DIR="$HOME/.bun/install/cache"

# Localizar um pacote cacheado
CACHED_PKG=$(find "$CACHE_DIR" -name "index.js" | head -1)
echo "Arquivo alvo: $CACHED_PKG"

# Em um ataque real: sobrescrever com codigo malicioso
# Todos os projetos que instalam este pacote usariam a versao comprometida

# Verificar permissoes do cache (deveria ser 700)
stat "$CACHE_DIR"
ls -la "$CACHE_DIR" | head -3
```

### Multi-User Cache Risks

```bash
# Se o cache for compartilhado entre usuarios (ex: em /var/cache/bun):
# Usuario A pode envenenar o cache para Usuario B

# Verificar propriedade do cache
stat -c "%U %G %a" "$HOME/.bun/install/cache" 2>/dev/null

# Cache privado (correto): pertence ao usuario, permissoes 700
# Cache compartilhado: PERIGO
```

### Race Condition em Cache

```bash
# Se dois processos instalam ao mesmo tempo:
# TOCTOU: verificar integridade e usar o arquivo sao operacoes separadas

# Demonstrar (inofensivo):
for i in 1 2 3; do
    bun install 2>/dev/null &
done
wait
echo "Instalacoes paralelas concluidas"
bun pm ls 2>/dev/null | head -5
```

---

## Exercises

### Ex P3.1 — Cache Inspection

```bash
# Analise completa do cache do Bun
cat > /tmp/inspect_cache.sh << 'EOF'
#!/bin/bash
CACHE="$HOME/.bun/install/cache"

echo "=== Cache do Bun ==="
echo "Localizacao: $CACHE"
echo "Tamanho: $(du -sh $CACHE 2>/dev/null | cut -f1)"
echo "Pacotes: $(ls $CACHE 2>/dev/null | wc -l)"
echo ""

echo "=== 10 pacotes maiores ==="
du -sh "$CACHE"/*/ 2>/dev/null | sort -rh | head -10

echo ""
echo "=== Verificar permissoes ==="
stat "$CACHE" | grep -E "Uid|Gid|Access"
EOF
bash /tmp/inspect_cache.sh
```

### Ex P3.2 — Cache Hit vs Miss

```bash
# Medir impacto do cache na velocidade de instalacao
mkdir -p /tmp/cache-bench
cd /tmp/cache-bench

cat > package.json << 'EOF'
{
  "name": "cache-bench",
  "dependencies": {
    "express": "^4.18.0",
    "lodash": "^4.17.21"
  }
}
EOF

# Limpar cache local do projeto
rm -rf node_modules bun.lockb

# Instalacao SEM cache (primeiro, pode precisar baixar)
echo "=== Instalacao inicial ==="
time bun install 2>/dev/null

# Reinstalacao COM cache
rm -rf node_modules bun.lockb
echo ""
echo "=== Reinstalacao com cache ==="
time bun install 2>/dev/null

# O segundo deve ser ~10x mais rapido
```

### Ex P3.3 — Cache Integrity Verification

```bash
# Verificar integridade do cache manualmente
cat > /tmp/verify_cache.sh << 'EOF'
#!/bin/bash
CACHE="$HOME/.bun/install/cache"
PACKAGE=${1:-"ms"}

echo "=== Verificando cache: $PACKAGE ==="

PKG_DIR=$(find "$CACHE" -name "${PACKAGE}*" -type d 2>/dev/null | head -1)
if [ -z "$PKG_DIR" ]; then
    echo "Pacote nao encontrado no cache"
    echo "Execute: bun add $PACKAGE para popular o cache"
    exit 1
fi

echo "Diretorio: $PKG_DIR"
echo "Arquivos:"
ls -la "$PKG_DIR" | head -10

# Calcular hash atual dos arquivos principais
MAIN_FILE=$(cat "$PKG_DIR/package.json" 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(d.get('main', 'index.js'))
" 2>/dev/null)

if [ -f "$PKG_DIR/$MAIN_FILE" ]; then
    echo ""
    echo "Hash do arquivo principal ($MAIN_FILE):"
    sha256sum "$PKG_DIR/$MAIN_FILE"
fi
EOF
bash /tmp/verify_cache.sh ms
```

---

## Checkpoint

[ ] Localizou o cache do Bun em `~/.bun/install/cache/`
[ ] Mediu diferenca de velocidade com e sem cache
[ ] Inspecionou estrutura de um pacote no cache
[ ] Entende o risco de cache poisoning
[ ] Verificou permissoes do diretorio de cache

---

## Next

→ [`04-hooks`](../04-hooks/) — lifecycle hooks de instalacao
