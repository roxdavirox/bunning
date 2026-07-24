# Fetch — Cliente HTTP do Bun

> Como Bun implementa fetch(), diferencias de browsers, e vetores de SSRF.

---

## Intuition (Feynman)

`fetch()` e a API padrao para fazer requests HTTP. No browser, ela tem restricoes de seguranca (CORS, HTTPS enforced, sem acesso a localhost arbitrario). No Bun, ela roda no servidor — sem CORS, sem restricoes de origin, podendo acessar qualquer rede — tornando-a poderosa e potencialmente perigosa.

---

## Source Code

No repositorio `oven-sh/bun`:
```
src/
├── fetch.zig            # Implementacao fetch
├── http_client.zig      # HTTP client
├── uws/                 # uWS como cliente tambem
└── bun.js/api/
    └── Fetch.zig        # JS API
```

---

## Hands-On Analysis

### 1. Fetch Basico

```typescript
// GET request
const response = await fetch("https://httpbin.org/get");
const data = await response.json();
console.log(data);

// POST com JSON
const res = await fetch("https://httpbin.org/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: "value" }),
});
console.log(await res.json());
```

### 2. Opcoes Avancadas

```typescript
// Timeout (nao padrao Web, extensao Bun)
const res = await fetch("https://httpbin.org/delay/5", {
    signal: AbortSignal.timeout(2000), // 2 segundos
});

// Proxy
const res2 = await fetch("https://example.com", {
    // @ts-ignore — extensao Bun
    proxy: "http://proxy.example.com:8080",
});

// Unix sockets
const res3 = await fetch("http://localhost/api", {
    unix: "/var/run/myapp.sock",
});

// TLS customizado
const res4 = await fetch("https://internal.example.com", {
    tls: {
        rejectUnauthorized: false, // PERIGO: desabilita verificacao
    },
});
```

### 3. Inspecionar Requests

```bash
# Usar httpbin.org para inspecionar o que Bun envia
cat > /tmp/inspect_fetch.ts << 'EOF'
const res = await fetch("https://httpbin.org/headers");
const data = await res.json();
console.log("Headers enviados:");
console.log(JSON.stringify(data.headers, null, 2));
EOF
bun /tmp/inspect_fetch.ts
```

---

## Security Analysis

### SSRF (Server-Side Request Forgery)

```typescript
// VULNERAVEL: usuario controla a URL
async function fetchUserUrl(url: string) {
    const res = await fetch(url); // SSRF!
    return res.text();
}

// Ataques possiveis:
// fetchUserUrl("http://169.254.169.254/latest/meta-data/") // AWS metadata
// fetchUserUrl("http://localhost:6379/")                    // Redis
// fetchUserUrl("file:///etc/passwd")                        // Arquivo local
// fetchUserUrl("http://interno.empresa.com/admin")          // Rede interna

// CORRETO: validar e restringir URLs
import { URL } from "url";

async function safeFetch(rawUrl: string): Promise<string> {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        throw new Error("URL invalida");
    }

    // Apenas HTTP/HTTPS publico
    if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Protocolo nao permitido");
    }

    // Bloquear IPs privados
    const hostname = url.hostname;
    if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname) ||
        hostname === "localhost" || hostname === "0.0.0.0") {
        throw new Error("Acesso a rede interna nao permitido");
    }

    const res = await fetch(url.toString());
    return res.text();
}
```

### File Protocol

```typescript
// Bun suporta fetch com file:// ???
try {
    const res = await fetch("file:///etc/hostname");
    const text = await res.text();
    console.log("file:// funciona:", text);
} catch (e) {
    console.log("file:// bloqueado:", e.message);
}

// Resultado importante para avaliar SSRF scope
```

### TLS Pinning

```typescript
// Sem TLS pinning, man-in-the-middle e possivel
// Em producao, nunca usar rejectUnauthorized: false

// Alternativa: pinning por hash do certificado
const res = await fetch("https://api.example.com", {
    tls: {
        // Nao disponivel nativamente, mas pode ser feito via
        // verificacao pos-resposta do certificado
    },
});
```

---

## Exercises

### Ex H2.1 — SSRF Scanner

```typescript
// Tente acessar servicos internos comuns via SSRF
const targets = [
    "http://127.0.0.1:22",          // SSH
    "http://127.0.0.1:3306",        // MySQL
    "http://127.0.0.1:5432",        // PostgreSQL
    "http://127.0.0.1:6379",        // Redis
    "http://127.0.0.1:27017",       // MongoDB
    "http://169.254.169.254/",      // AWS metadata
    "http://metadata.google.internal/", // GCP metadata
];

for (const target of targets) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 500);

        const res = await fetch(target, {
            signal: controller.signal,
        });
        clearTimeout(timeout);

        console.log(`[ABERTO] ${target} → ${res.status}`);
    } catch (e) {
        const reason = e.name === "AbortError" ? "timeout" : e.code ?? e.message;
        console.log(`[FECHADO] ${target} → ${reason}`);
    }
}
```

### Ex H2.2 — Header Injection via Fetch

```typescript
// Testar injecao via headers em fetch
const maliciousHeaders = [
    ["X-Test", "value\r\nX-Injected: injected"],
    ["X-Test", "value\nX-Injected: injected"],
    ["Host", "evil.com"],
];

for (const [name, value] of maliciousHeaders) {
    try {
        const res = await fetch("https://httpbin.org/headers", {
            headers: { [name]: value }
        });
        const data = await res.json();
        console.log(`Header "${name}: ${value}":`);
        console.log(JSON.stringify(data.headers, null, 2));
    } catch (e) {
        console.log(`BLOQUEADO: ${name}: ${e.message}`);
    }
}
```

### Ex H2.3 — Redirect Following

```typescript
// Bun segue redirects por padrao — pode vazar dados
// Ex: redirect de HTTPS para HTTP (downgrade)

// Inspecionar comportamento de redirect
const res = await fetch("https://httpbin.org/redirect/3", {
    redirect: "manual",  // nao seguir automaticamente
});

console.log("Status:", res.status);
console.log("Location:", res.headers.get("Location"));

// Com redirect: "follow" (padrao)
const res2 = await fetch("https://httpbin.org/redirect/3");
console.log("Status final:", res2.status);
console.log("URL final:", res2.url);
```

---

## Checkpoint

[ ] Fetch basico funcionando (GET, POST, headers)
[ ] Entende SSRF e testou acesso a servicos internos
[ ] Implementou validacao de URL contra SSRF
[ ] Testou file:// protocol no Bun
[ ] Entende comportamento de redirects

---

## Next

→ [`03-websocket`](../03-websocket/) — WebSockets no Bun
