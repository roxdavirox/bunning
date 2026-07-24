# Supply Chain — Ataques via Dependencias

> Como atacantes comprometem software via pacotes npm e como detectar.

---

## Intuition (Feynman)

Supply chain attack e como envenenar uma fonte d'agua publica: em vez de atacar cada casa individualmente, voce contamina a fonte que todas usam. No ecossistema npm, a "fonte" sao os pacotes que milhoes de projetos dependem.

Uma dependencia comprometida pode conter codigo malicioso que roda no seu sistema quando voce faz `bun add`.

---

## Source Code

```
# Ferramentas de analise:
# - npm audit (banco de dados de vulnerabilidades)
# - bun audit (quando disponivel)
# - socket.dev (analise em tempo real)
# - OpenSSF Scorecard (pontuacao de seguranca)
```

---

## Hands-On Analysis

### 1. Casos Historicos

```bash
# Casos reais documentados:

echo "=== event-stream (2018) ==="
# O pacote event-stream (2 milhoes de downloads/semana) foi comprometido
# Atacante ganhou controle do repositorio e injetou codigo para roubar
# credenciais de carteiras Bitcoin Copay
# Descoberto: dependencia maliciosa hidden em dependencia transitiva

echo "=== ua-parser-js (2021) ==="
# Conta npm comprometida
# Mineiro de criptomoeda + backdoor injetados
# 8 milhoes de downloads/semana afetados

echo "=== colors/faker (2022) ==="
# Autor intencional: Marak Squires vandalizou seus proprios pacotes
# Para protestar contra uso corporativo sem compensacao
# Demonstrou dependencia critica em um unico mantenedor

echo "=== node-ipc (2022) ==="
# Brandon Nozaki Miller adicionou wiper de disco direcionado a IPs russos/belarussos
# Protestando contra invasao da Ucrania
```

### 2. Verificar Vulnerabilidades Conhecidas

```bash
# npm audit: verifica contra National Vulnerability Database
npm audit --json 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
meta = data.get('metadata', {}).get('vulnerabilities', {})
print(f'Critical: {meta.get(\"critical\", 0)}')
print(f'High: {meta.get(\"high\", 0)}')
print(f'Moderate: {meta.get(\"moderate\", 0)}')
print(f'Low: {meta.get(\"low\", 0)}')
" 2>/dev/null

# Verificar pacote especifico
npm audit --json 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
for name, vuln in list(data.get('vulnerabilities', {}).items())[:5]:
    print(f'{name}: {vuln.get(\"severity\")} - {vuln.get(\"title\", \"?\")}')
"
```

### 3. Analise de Pacote Suspeito

```bash
# Antes de instalar um pacote, investigar:

PACKAGE="some-package"

# 1. Quando foi publicado?
curl -s "https://registry.npmjs.org/$PACKAGE" | python3 -c "
import json, sys, datetime
d=json.load(sys.stdin)
time=d.get('time',{})
created=time.get('created','?')
modified=time.get('modified','?')
print(f'Criado: {created}')
print(f'Modificado: {modified}')
print(f'Versoes: {len(time)-2}')
"

# 2. Quem publicou?
curl -s "https://registry.npmjs.org/$PACKAGE/latest" | python3 -c "
import json, sys
d=json.load(sys.stdin)
print(f'Publisher: {d.get(\"_npmUser\",{}).get(\"name\",\"?\")}')
print(f'Maintainers: {[m.get(\"name\") for m in d.get(\"maintainers\",[])]}')
"
```

---

## Security Analysis

### Attack Vectors

```
1. Account Takeover
   Atacante compromete conta npm de mantenedor popular
   → Publica versao com backdoor

2. Typosquatting
   Registra "lodash" similar: "1odash", "lodahs", "Lodash"
   → Desenvolvedor erra ao digitar e instala malware

3. Dependency Confusion
   Pacote interno "acme-utils" — atacante publica "acme-utils" no npm publico
   → Registry resolve para versao publica (maior versao ganha)

4. Malicious Maintainer
   Projeto abandona-se, atacante oferece "ajuda"
   → Ganha controle e injeta codigo

5. Build System Compromise
   Comprometer o CI/CD que publica o pacote
   → Codigo fonte parece limpo mas binario e malicioso
```

### Deteccao Automatizada

```bash
# OpenSSF Scorecard: verificar praticas de seguranca do projeto
# (requer Go/Docker)
# scorecard --repo github.com/lodash/lodash

# Socket.dev: analise comportamental
# npm install --before 2022-01-01 era o antigo trust window
# socket.dev tem uma API publica

# Verificar manualmente indicadores suspeitos
curl -s "https://registry.npmjs.org/express/latest" | python3 -c "
import json, sys
d = json.load(sys.stdin)

scripts = d.get('scripts', {})
print('Scripts:', list(scripts.keys()))

deps = {**d.get('dependencies', {}), **d.get('devDependencies', {})}
print(f'Dependencias: {len(deps)}')

# Dependencias suspeitas comuns em malware
suspicious = ['shelljs', 'node-fetch', 'axios', 'cross-fetch']
for s in suspicious:
    if s in deps:
        print(f'[NOTA] Tem dependencia: {s}')
"
```

---

## Exercises

### Ex S3.1 — Supply Chain Audit

```bash
# Auditoria completa de supply chain
cat > /tmp/supply_chain_audit.sh << 'EOF'
#!/bin/bash
echo "=== Supply Chain Audit ==="
echo ""

echo "--- Vulnerabilidades conhecidas ---"
npm audit 2>/dev/null | tail -5 || echo "npm audit nao disponivel"

echo ""
echo "--- Pacotes com lifecycle scripts ---"
node -e "
const fs = require('fs');
const pkgs = fs.readdirSync('node_modules').filter(d => !d.startsWith('.'));
let count = 0;
pkgs.forEach(pkg => {
    try {
        const pkg_json = JSON.parse(fs.readFileSync(\`node_modules/\${pkg}/package.json\`, 'utf-8'));
        const scripts = pkg_json.scripts || {};
        const hooks = ['preinstall','postinstall','install','prepare'];
        hooks.forEach(hook => {
            if (scripts[hook]) {
                console.log(\`  \${pkg}: \${hook} → \${scripts[hook].substring(0,60)}\`);
                count++;
            }
        });
    } catch(e) {}
});
console.log(\`Total: \${count} hooks\`);
" 2>/dev/null

echo ""
echo "--- Pacotes publicados recentemente (<30 dias) ---"
for pkg in $(ls node_modules | head -20); do
    published=$(curl -s "https://registry.npmjs.org/$pkg/latest" 2>/dev/null | \
        python3 -c "import json,sys,datetime; d=json.load(sys.stdin); \
        t=d.get('_time',''); print(t[:10] if t else '?')" 2>/dev/null)
    if [ -n "$published" ] && [ "$published" != "?" ]; then
        days=$(( ($(date +%s) - $(date -d "$published" +%s 2>/dev/null || echo 0)) / 86400 ))
        [ "$days" -lt 30 ] 2>/dev/null && echo "  $pkg: $published ($days dias)"
    fi
done
EOF
bash /tmp/supply_chain_audit.sh
```

### Ex S3.2 — Typosquatting Checker

```bash
# Verificar se typos dos seus pacotes existem no npm
cat > /tmp/typo_check.sh << 'EOF'
#!/bin/bash
echo "=== Verificacao de Typosquatting ==="

PACKAGES=$(cat package.json | python3 -c "
import json,sys
d=json.load(sys.stdin)
deps=list((d.get('dependencies') or {}).keys())
devdeps=list((d.get('devDependencies') or {}).keys())
print(' '.join(set(deps+devdeps)))
" 2>/dev/null)

for pkg in $PACKAGES; do
    # Gerar typos comuns
    typos=()
    # Transpor primeiro par de letras
    if [ ${#pkg} -gt 2 ]; then
        typo="${pkg:1:1}${pkg:0:1}${pkg:2}"
        typos+=("$typo")
    fi
    # Substituir - por _
    typo="${pkg//-/_}"
    [ "$typo" != "$pkg" ] && typos+=("$typo")

    for typo in "${typos[@]}"; do
        status=$(curl -so /dev/null -w "%{http_code}" "https://registry.npmjs.org/$typo")
        if [ "$status" = "200" ]; then
            echo "[EXISTE] $pkg → typo '$typo' existe no npm!"
        fi
    done
done
EOF
bash /tmp/typo_check.sh
```

### Ex S3.3 — Dependency Confusion Probe

```bash
# Verificar se pacotes "internos" existem no npm publico
cat > /tmp/confusion_check.sh << 'EOF'
#!/bin/bash
echo "=== Dependency Confusion Check ==="

# Pacotes que parecem ser internos (nomes com prefixo da empresa)
# Ajustar conforme seu contexto
INTERNAL_PREFIXES=("@mycompany" "@internal" "@corp")

for prefix in "${INTERNAL_PREFIXES[@]}"; do
    pkgs=$(cat package.json node_modules/*/package.json 2>/dev/null | \
        grep -o "\"${prefix}/[^\"]*\"" | sort -u)

    for pkg in $pkgs; do
        pkg="${pkg//\"/}"
        status=$(curl -so /dev/null -w "%{http_code}" "https://registry.npmjs.org/$pkg")
        if [ "$status" = "200" ]; then
            echo "[RISCO] $pkg existe no npm publico!"
        else
            echo "[OK] $pkg e privado"
        fi
    done
done
EOF
bash /tmp/confusion_check.sh
```

---

## Checkpoint

[ ] Conhece os casos historicos (event-stream, ua-parser-js)
[ ] Executou npm audit no projeto
[ ] Verificou lifecycle scripts de todos os pacotes
[ ] Implementou checker de typosquatting
[ ] Entende os 5 attack vectors de supply chain

---

## Next

→ [`04-cve-analysis`](../04-cve-analysis/) — analise de CVEs do Bun
