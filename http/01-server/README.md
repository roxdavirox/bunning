# HTTP Server — Bun.serve() e uWebSockets

> Servidor HTTP nativo do Bun: arquitetura, performance, e superficie de ataque.

---

## Intuition (Feynman)

O servidor HTTP do Bun e construido sobre µWebSockets (uWS) — uma biblioteca C++ extremamente rapida. Enquanto Node.js usa uma pilha mais complexa (HTTP parser em C → libuv → V8), o Bun integra diretamente com uWS e JSC, eliminando camadas.

O resultado: Bun serve ~3x mais requests/segundo que Express em Node.js, mas com uma superficie de ataque diferente — vulnerabilidades em uWS, em vez de em http_parser.

---

## Source Code

No repositorio `oven-sh/bun`:
```
src/
├── bun/serve.zig          # Bun.serve() implementation
├── http.zig               # HTTP internals
├── uws/                   # µWebSockets bindings
│   ├── uws.zig
│   └── ...
└── bun.js/api/
    └── Server.zig         # JS API
```

---

## Hands-On Analysis

### 1. Servidor Basico

```typescript
const server = Bun.serve({
    port: 3000,
    hostname: "0.0.0.0",

    fetch(request: Request): Response {
        const url = new URL(request.url);

        if (url.pathname === "/") {
            return new Response("Hello, Bun!", {
                headers: { "Content-Type": "text/plain" }
            });
        }

        return new Response("Not Found", { status: 404 });
    },
});

console.log(`Servidor em http://localhost:${server.port}`);
```

### 2. Request e Response

```typescript
Bun.serve({
    port: 3000,
    async fetch(req: Request): Promise<Response> {
        // Request info
        console.log({
            method: req.method,
            url: req.url,
            headers: Object.fromEntries(req.headers),
        });

        // Ler body
        if (req.method === "POST") {
            const body = await req.json();
            return Response.json({ received: body });
        }

        // Response com headers customizados
        return new Response("OK", {
            status: 200,
            headers: {
                "X-Custom": "value",
                "Content-Security-Policy": "default-src 'self'",
            },
        });
    },
});
```

### 3. Performance Benchmark

```bash
# Benchmark com wrk
cat > /tmp/bench_server.ts << 'EOF'
Bun.serve({
    port: 8080,
    fetch() {
        return new Response("Hello!");
    },
});
console.log("Servidor na porta 8080");
EOF

bun /tmp/bench_server.ts &
sleep 0.5

# Benchmark
if command -v wrk &> /dev/null; then
    wrk -t4 -c100 -d10s http://localhost:8080/
elif command -v ab &> /dev/null; then
    ab -n 10000 -c 100 http://localhost:8080/
else
    echo "Instale wrk ou ab para benchmark"
    curl -s http://localhost:8080/
fi

kill %1 2>/dev/null
```

---

## Security Analysis

### Headers de Seguranca

```typescript
// Headers de seguranca que DEVEM ser enviados
function secureHeaders(): HeadersInit {
    return {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy": "default-src 'self'",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    };
}

Bun.serve({
    port: 3000,
    fetch(req) {
        return new Response("Seguro!", {
            headers: secureHeaders()
        });
    },
});
```

### Path Traversal

```typescript
// VULNERAVEL: path traversal
Bun.serve({
    port: 3000,
    async fetch(req) {
        const url = new URL(req.url);
        const filename = url.pathname.slice(1); // remove "/"

        // PERIGO: filename pode ser "../../etc/passwd"
        const file = Bun.file(`./public/${filename}`);

        if (await file.exists()) {
            return new Response(file);
        }
        return new Response("Not Found", { status: 404 });
    },
});

// CORRETO: sanitizar o path
import { resolve, join } from "path";

function safeServeFile(basedir: string, reqPath: string): Response {
    const safe = join(basedir, reqPath);
    // resolve() normaliza ".." etc
    if (!resolve(safe).startsWith(resolve(basedir))) {
        return new Response("Forbidden", { status: 403 });
    }
    return new Response(Bun.file(safe));
}
```

### Request Smuggling

```bash
# Bun usa uWS que tem historico de issues com request parsing
# HTTP Request Smuggling: manipular como proxy vs servidor interpretam requests

# Teste basico com Transfer-Encoding e Content-Length conflitantes
curl -v --http1.1 \
    -H "Content-Length: 13" \
    -H "Transfer-Encoding: chunked" \
    -d "5\r\nHello\r\n0\r\n\r\n" \
    http://localhost:3000/ 2>&1 | head -30
```

---

## Exercises

### Ex H1.1 — Secure Static Server

```typescript
// Implemente um servidor de arquivos estaticos seguro
import { join, resolve } from "path";

const PUBLIC_DIR = "./public";

Bun.serve({
    port: 3000,
    async fetch(req) {
        const url = new URL(req.url);

        // Sanitizar path
        const reqPath = decodeURIComponent(url.pathname);
        const fullPath = join(PUBLIC_DIR, reqPath);

        if (!resolve(fullPath).startsWith(resolve(PUBLIC_DIR))) {
            return new Response("Forbidden", { status: 403 });
        }

        const file = Bun.file(fullPath);
        if (!(await file.exists())) {
            return new Response("Not Found", { status: 404 });
        }

        return new Response(file, {
            headers: {
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "public, max-age=3600",
            },
        });
    },
});
```

### Ex H1.2 — Rate Limiting

```typescript
// Rate limiting simples por IP
const requestCounts = new Map<string, { count: number; reset: number }>();

function rateLimiter(ip: string, limit = 100, windowMs = 60000): boolean {
    const now = Date.now();
    const entry = requestCounts.get(ip);

    if (!entry || entry.reset < now) {
        requestCounts.set(ip, { count: 1, reset: now + windowMs });
        return true;
    }

    entry.count++;
    return entry.count <= limit;
}

Bun.serve({
    port: 3000,
    fetch(req, server) {
        const ip = server.requestIP(req)?.address ?? "unknown";

        if (!rateLimiter(ip)) {
            return new Response("Too Many Requests", {
                status: 429,
                headers: { "Retry-After": "60" },
            });
        }

        return new Response("OK");
    },
});
```

### Ex H1.3 — Header Injection Test

```bash
# Testar se headers maliciosos passam pelo Bun
# CRLF injection: \r\n pode criar headers falsos
curl -v "http://localhost:3000/" \
    -H $'X-Test: value\r\nX-Injected: injected' 2>&1 | head -20

# Header com null byte
curl -v "http://localhost:3000/" \
    -H $'X-Test: value\x00injected' 2>&1 | head -20
```

---

## Checkpoint

[ ] Servidor basico funcionando com Bun.serve()
[ ] Headers de seguranca configurados
[ ] Implementou protecao contra path traversal
[ ] Implementou rate limiting
[ ] Testou injecao de headers

---

## Next

→ [`02-fetch`](../02-fetch/) — cliente HTTP fetch() do Bun
