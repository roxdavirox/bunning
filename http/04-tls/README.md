# TLS — HTTPS e Seguranca de Transporte no Bun

> Como Bun implementa TLS, configuracoes seguras, e vetores de ataque.

---

## Intuition (Feynman)

TLS e o envelope lacrado do mundo digital. Quando voce usa HTTPS, seus dados viajam dentro de um envelope que so o destinatario correto pode abrir. Bun usa BoringSSL (fork do OpenSSL do Google) para TLS — mesma lib do Chrome e Node.js.

A diferenca no Bun: configuracoes erradas de TLS sao mais faceis de cometer porque o runtime nao tem defaults tao conservadores quanto um browser.

---

## Source Code

No repositorio `oven-sh/bun`:
```
src/
├── boringssl.zig        # BoringSSL bindings
├── tls.zig              # TLS layer
└── bun.js/api/
    └── TLS.zig          # JS API
```

---

## Hands-On Analysis

### 1. Servidor HTTPS

```bash
# Gerar certificado self-signed para testes
openssl req -x509 -newkey rsa:4096 -keyout /tmp/key.pem \
    -out /tmp/cert.pem -days 365 -nodes \
    -subj "/C=BR/ST=SP/L=SP/O=Lab/CN=localhost"
```

```typescript
Bun.serve({
    port: 3443,
    tls: {
        key: Bun.file("/tmp/key.pem"),
        cert: Bun.file("/tmp/cert.pem"),
        // Configuracoes opcionais:
        // ca: Bun.file("/tmp/ca.pem"),    // CA customizada
        // passphrase: "senha",            // Se a chave for criptografada
        // dhParamsFile: "/tmp/dh.pem",    // Diffie-Hellman params
    },

    fetch(req) {
        return new Response("HTTPS funcionando!", {
            headers: {
                "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
            }
        });
    },
});

console.log("HTTPS em https://localhost:3443");
```

### 2. Verificar TLS

```bash
# Inspecionar certificado
openssl s_client -connect localhost:3443 -showcerts 2>/dev/null | \
    openssl x509 -text -noout | grep -E "Subject:|Issuer:|Not After|Public Key"

# Ver suites suportadas
openssl s_client -connect localhost:3443 -tls1_2 2>&1 | grep "Cipher"
openssl s_client -connect localhost:3443 -tls1_3 2>&1 | grep "Cipher"

# Verificar protocolos antigos (devem falhar)
openssl s_client -connect localhost:3443 -ssl3 2>&1 | head -5
openssl s_client -connect localhost:3443 -tls1 2>&1 | head -5
```

### 3. Mutual TLS (mTLS)

```typescript
// mTLS: servidor e cliente autenticam mutuamente
Bun.serve({
    port: 3443,
    tls: {
        key: Bun.file("/tmp/server-key.pem"),
        cert: Bun.file("/tmp/server-cert.pem"),
        ca: Bun.file("/tmp/ca-cert.pem"),
        requestCert: true,  // solicitar certificado do cliente
        rejectUnauthorized: true, // rejeitar sem certificado valido
    },
    fetch(req) {
        // Certificado do cliente esta disponivel
        return new Response("mTLS OK");
    },
});
```

---

## Security Analysis

### Configuracoes Perigosas

```typescript
// PERIGO 1: desabilitar verificacao de certificado
const res = await fetch("https://internal.example.com", {
    tls: { rejectUnauthorized: false } // nunca em producao!
});

// PERIGO 2: certificados auto-assinados em producao
// Use Let's Encrypt ou CA corporativa

// PERIGO 3: TLS 1.0/1.1 habilitado
// Bun usa BoringSSL que por padrao desabilita TLS < 1.2

// PERIGO 4: suites criptograficas fracas
// NULL, EXPORT, RC4, DES, 3DES — todas devem ser bloqueadas
```

### Verificar Configuracao TLS

```bash
# testssl.sh: ferramenta completa de auditoria TLS
# Instalar: apt install testssl.sh ou baixar do github

# Verificar vulnerabilidades
testssl.sh localhost:3443 2>/dev/null | grep -E "(WARN|FATAL|CRITICAL|OK)"

# Alternativa: sslyze
# pip install sslyze
# python -m sslyze localhost:3443

# Verificacao manual de cipher suites
for cipher in $(openssl ciphers 'ALL:eNULL' | tr ':' ' '); do
    result=$(openssl s_client -connect localhost:3443 \
        -cipher $cipher 2>/dev/null < /dev/null | grep "Cipher is")
    [ -n "$result" ] && echo "$cipher: $result"
done
```

### Certificate Pinning

```typescript
// Pinning via hash do certificado
import { createHash } from "crypto";

async function pinnedFetch(url: string, expectedPin: string) {
    const res = await fetch(url);

    // Verificar pin via peer certificate (nao disponivel diretamente no Bun)
    // Workaround: verificar via TLS socket info se disponivel

    return res;
}

// Melhor abordagem: usar CA corporativa para servicos internos
// e confiar apenas nessa CA
```

---

## Exercises

### Ex H4.1 — HTTPS Server

```bash
# Configure e teste um servidor HTTPS completo

# 1. Gerar certificados
mkdir -p /tmp/tls-lab
openssl genrsa -out /tmp/tls-lab/key.pem 4096
openssl req -new -x509 -key /tmp/tls-lab/key.pem \
    -out /tmp/tls-lab/cert.pem -days 365 \
    -subj "/CN=localhost"

# 2. Criar servidor
cat > /tmp/tls-lab/server.ts << 'EOF'
Bun.serve({
    port: 3443,
    tls: {
        key: Bun.file("/tmp/tls-lab/key.pem"),
        cert: Bun.file("/tmp/tls-lab/cert.pem"),
    },
    fetch(req) {
        return new Response(JSON.stringify({
            protocol: req.url.startsWith("https") ? "HTTPS" : "HTTP",
            host: req.headers.get("host"),
        }), { headers: { "Content-Type": "application/json" } });
    },
});
console.log("HTTPS: https://localhost:3443");
EOF

# 3. Testar
bun /tmp/tls-lab/server.ts &
sleep 0.5
curl -sk https://localhost:3443/ | jq
kill %1
```

### Ex H4.2 — TLS Audit

```bash
# Auditar configuracao TLS do servidor
cat > /tmp/tls_audit.sh << 'EOF'
#!/bin/bash
HOST=${1:-localhost}
PORT=${2:-3443}

echo "=== Auditoria TLS: $HOST:$PORT ==="

# Versoes suportadas
for ver in ssl2 ssl3 tls1 tls1_1 tls1_2 tls1_3; do
    result=$(echo "" | openssl s_client -connect $HOST:$PORT \
        -$ver 2>&1 | grep "Protocol\|Cipher\|ERROR")
    echo "$ver: $result"
done

# Certificado
echo ""
echo "=== Certificado ==="
echo "" | openssl s_client -connect $HOST:$PORT 2>/dev/null | \
    openssl x509 -noout -text 2>/dev/null | \
    grep -E "Subject:|Not After|Public Key Algorithm|RSA Public-Key"
EOF
chmod +x /tmp/tls_audit.sh
```

### Ex H4.3 — Self-Signed vs Let's Encrypt

```bash
# Verificar diferenca entre certificado self-signed e CA publica

# Self-signed (sem confianca)
echo "" | openssl s_client -connect localhost:3443 2>&1 | grep "Verify"

# Producao (com CA publica) — exemplo httpbin
echo "" | openssl s_client -connect httpbin.org:443 2>&1 | grep "Verify"

# A diferenca: "Verify return code: 0 (ok)" vs "18 (self signed)"
```

---

## Checkpoint

[ ] Servidor HTTPS funcionando com certificado self-signed
[ ] Auditou versoes TLS suportadas
[ ] Entende o risco de rejectUnauthorized: false
[ ] Sabe verificar certificado via openssl s_client
[ ] Entende a diferenca entre self-signed e CA publica

---

## Next

→ [`../bundler/01-parser`](../../bundler/01-parser/) — parser JavaScript/TypeScript do Bun
