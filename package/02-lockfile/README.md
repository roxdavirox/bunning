# Lockfile — bun.lockb e Integridade de Dependencias

> O formato binario do lockfile do Bun, reproducibilidade de builds, e ataques.

---

## Intuition (Feynman)

O lockfile e como uma lista de compras com o preco exato de cada item e o codigo de barras. Sem lockfile, `bun install` pode instalar versoes diferentes em maquinas diferentes. Com lockfile, todos instalam exatamente os mesmos pacotes (mesmos hashes).

O Bun usa um formato binario (`bun.lockb`) em vez do texto legivel (`package-lock.json` do npm). Isso e mais rapido mas menos inspecionavel — voce nao consegue ler o lockfile com `cat`.

---

## Source Code

No repositorio `oven-sh/bun`:
```
src/
├── install/
│   └── lockfile.zig    # Formato e serializacao do lockfile
└── ...
```

---

## Hands-On Analysis

### 1. Trabalhando com bun.lockb

```bash
# O lockfile e binario — nao legivel diretamente
file bun.lockb
xxd bun.lockb | head -5

# Converter para texto legivel
bun pm ls              # listar pacotes instalados
bun pm hash            # hash do lockfile atual
bun pm hash-print      # imprimir hash

# Para ver o conteudo como JSON (workaround):
bun install --frozen-lockfile --dry-run 2>/dev/null

# Alternativa: usar git para ver diferencas
git diff bun.lockb 2>/dev/null | head -20
```

### 2. Reproducibilidade

```bash
# Instalar EXATAMENTE o que o lockfile especifica
bun install --frozen-lockfile    # falha se lockfile diferente de package.json
bun install --no-save            # nao atualiza lockfile

# CI: sempre usar frozen
# package.json scripts:
# "ci": "bun install --frozen-lockfile"

# Verificar que lockfile esta em sync
bun install --check
```

### 3. Formato Interno

```bash
# bun.lockb usa um formato proprietario baseado em BIFF (Binary Interface Format)
# Ver magic bytes
xxd bun.lockb | head -3
# Esperado: magic bytes do formato Bun

# Comparar tamanhos: bun vs npm lockfile
wc -c bun.lockb
wc -c package-lock.json 2>/dev/null || echo "nao existe"

# bun.lockb e tipicamente 10-20x menor que package-lock.json
```

---

## Security Analysis

### Lockfile Poisoning

```bash
# Ataque: modificar lockfile para apontar para versao maliciosa
# Como o bun.lockb e binario, e mais dificil modificar que package-lock.json

# MAS: se um atacante tiver acesso ao repo:
# 1. Modificar bun.lockb para apontar para versao com backdoor
# 2. Manter package.json com versao legivel sem mudanca
# 3. Desenvolvedores fazem `bun install` e instalam versao maliciosa

# Deteccao: verificar que o hash do lockfile nao mudou inesperadamente
git log --oneline bun.lockb | head -5
git show HEAD:bun.lockb | md5sum
```

### Dependencias Transitivas

```bash
# O que REALMENTE e instalado?
# Nem sempre e obvio pelas dependencias diretas

# Listar tudo que foi instalado
bun pm ls --all 2>/dev/null | wc -l

# Comparar com dependencias diretas
cat package.json | jq '(.dependencies // {}) + (.devDependencies // {}) | keys | length'

# A diferenca sao as dependencias transitivas — menos visibilidade
```

### Verificacao de Integridade

```bash
# Bun verifica hashes dos pacotes baixados contra o registry
# Mas nao verifica o registry em si

# Para verificacao adicional, usar npm audit
npm audit --json 2>/dev/null | jq '.metadata.vulnerabilities'

# Ou com bun (se disponivel):
bun audit 2>/dev/null || npm audit 2>/dev/null | head -20
```

---

## Exercises

### Ex P2.1 — Lockfile Diff

```bash
# Monitore mudancas no lockfile
mkdir -p /tmp/lockfile-lab
cd /tmp/lockfile-lab

echo '{"name":"test","version":"1.0.0"}' > package.json
bun init -y 2>/dev/null

# Snapshot inicial
bun install 2>/dev/null
md5sum bun.lockb > /tmp/lockfile_before.md5

# Adicionar dependencia
bun add ms 2>/dev/null

# Comparar
md5sum bun.lockb > /tmp/lockfile_after.md5
diff /tmp/lockfile_before.md5 /tmp/lockfile_after.md5

echo "Pacotes antes: $(cat package.json | jq '.dependencies | length // 0')"
echo "Pacotes agora:"
bun pm ls 2>/dev/null | head -10
```

### Ex P2.2 — Frozen Lockfile em CI

```bash
# Simular verificacao de CI com frozen lockfile
mkdir -p /tmp/ci-test
cd /tmp/ci-test

cat > package.json << 'EOF'
{
  "name": "ci-test",
  "version": "1.0.0",
  "dependencies": {
    "ms": "^2.1.0"
  }
}
EOF

# Instalar e criar lockfile
bun install 2>/dev/null
echo "Lockfile criado"

# Simular mudanca no package.json sem atualizar lockfile
echo '{"name":"ci-test","version":"1.0.0","dependencies":{"ms":"^2.0.0","express":"^4.0.0"}}' > package.json

# Tentar instalar com frozen lockfile (deve falhar)
bun install --frozen-lockfile 2>&1
echo "Exit code: $?"
```

### Ex P2.3 — Auditoria de Dependencias Transitivas

```bash
# Mapear arvore completa de dependencias
cat > /tmp/dep_audit.sh << 'EOF'
#!/bin/bash
echo "=== Auditoria de Dependencias Transitivas ==="

DIRECT=$(cat package.json | python3 -c "
import json,sys
d=json.load(sys.stdin)
deps = list((d.get('dependencies') or {}).keys())
devdeps = list((d.get('devDependencies') or {}).keys())
print('\n'.join(sorted(set(deps + devdeps))))
")

echo "Dependencias diretas: $(echo "$DIRECT" | wc -l)"
echo "Total instalado: $(ls node_modules | wc -l)"

echo ""
echo "Dependencias transitivas (NAO declaradas no package.json):"
for pkg in $(ls node_modules); do
    if ! echo "$DIRECT" | grep -qx "$pkg"; then
        echo "  - $pkg"
    fi
done | head -20
EOF
bash /tmp/dep_audit.sh
```

---

## Checkpoint

[ ] Entende que bun.lockb e binario (nao legivel com cat)
[ ] Usou `--frozen-lockfile` para reproducibilidade
[ ] Entende o risco de lockfile poisoning
[ ] Listou dependencias transitivas vs diretas
[ ] Verificou mudancas no lockfile via git

---

## Next

→ [`03-cache`](../03-cache/) — sistema de cache global do Bun
