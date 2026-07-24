# WebSocket — Comunicacao Bidirecional em Bun

> Implementacao WebSocket do Bun, uWS internals, e vetores de ataque.

---

## Intuition (Feynman)

HTTP e como enviar cartas: voce manda uma, espera resposta, fecha a conexao. WebSocket e como uma chamada telefonica: abre uma conexao e ambos os lados podem falar a qualquer momento.

Bun usa µWebSockets (uWS) para WebSockets — a mesma biblioteca que implementa o servidor HTTP. Isso significa excelente performance mas tambem que vulnerabilidades em uWS afetam tanto HTTP quanto WS.

---

## Source Code

No repositorio `oven-sh/bun`:
```
src/
├── bun/
│   └── websocket.zig      # WebSocket server
├── uws/                   # µWebSockets
│   └── uws.zig
└── bun.js/api/
    └── WebSocket.zig      # JS API
```

---

## Hands-On Analysis

### 1. Servidor WebSocket

```typescript
const server = Bun.serve({
    port: 3001,

    fetch(req, server) {
        // Upgrade de HTTP para WebSocket
        if (server.upgrade(req, {
            data: {
                userId: crypto.randomUUID(),
                ip: server.requestIP(req)?.address,
            }
        })) {
            return; // upgrade bem-sucedido, sem Response
        }

        return new Response("Conecte via WebSocket", { status: 200 });
    },

    websocket: {
        open(ws) {
            console.log(`Conectado: ${ws.data.userId}`);
            ws.send(JSON.stringify({ type: "welcome", id: ws.data.userId }));
        },

        message(ws, message) {
            console.log(`Mensagem de ${ws.data.userId}:`, message);
            ws.send(`Echo: ${message}`);
        },

        close(ws, code, reason) {
            console.log(`Desconectado: ${ws.data.userId} (${code}: ${reason})`);
        },

        drain(ws) {
            // Buffer liberado — pode enviar mais dados
        },
    },
});
```

### 2. Cliente WebSocket

```typescript
// Cliente nativo do Bun
const ws = new WebSocket("ws://localhost:3001");

ws.onopen = () => {
    console.log("Conectado!");
    ws.send("Hello, Bun!");
};

ws.onmessage = (event) => {
    console.log("Recebido:", event.data);
};

ws.onclose = (event) => {
    console.log(`Fechado: ${event.code} - ${event.reason}`);
};

ws.onerror = (error) => {
    console.error("Erro:", error);
};
```

### 3. Broadcast e Rooms

```typescript
// Pub/Sub nativo do Bun (uWS feature)
const server = Bun.serve({
    port: 3001,
    fetch(req, server) {
        const url = new URL(req.url);
        const room = url.searchParams.get("room") ?? "default";

        server.upgrade(req, { data: { room } });
        return;
    },
    websocket: {
        open(ws) {
            // Subscribe a um canal
            ws.subscribe(ws.data.room);
            server.publish(ws.data.room, `${ws.data.room}: usuario entrou`);
        },

        message(ws, msg) {
            // Publicar para todos no mesmo canal
            server.publish(ws.data.room, msg);
        },

        close(ws) {
            server.publish(ws.data.room, `${ws.data.room}: usuario saiu`);
        },
    },
});
```

---

## Security Analysis

### Cross-Site WebSocket Hijacking (CSWSH)

```typescript
// VULNERAVEL: nao valida Origin
const server = Bun.serve({
    port: 3001,
    fetch(req, server) {
        server.upgrade(req); // qualquer origem pode conectar!
        return;
    },
    websocket: { message(ws, msg) { ws.send(msg); } },
});

// CORRETO: validar Origin
fetch(req, server) {
    const origin = req.headers.get("Origin");
    const allowed = ["https://meu-site.com", "https://www.meu-site.com"];

    if (origin && !allowed.includes(origin)) {
        return new Response("Forbidden", { status: 403 });
    }

    server.upgrade(req);
    return;
},
```

### DoS via Message Size

```typescript
// Sem limite de tamanho de mensagem, cliente pode enviar dados enormes
const server = Bun.serve({
    port: 3001,
    fetch(req, server) { server.upgrade(req); return; },
    websocket: {
        maxPayloadLength: 1024 * 64, // 64KB limite

        message(ws, msg) {
            if (typeof msg === "string" && msg.length > 10000) {
                ws.close(1009, "Message too large"); // 1009 = Message Too Big
                return;
            }
            ws.send(msg);
        },
    },
});
```

### Message Injection

```typescript
// Validar e sanitizar mensagens recebidas
const server = Bun.serve({
    port: 3001,
    fetch(req, server) { server.upgrade(req); return; },
    websocket: {
        message(ws, msg) {
            // Validar que e JSON valido
            let parsed;
            try {
                parsed = JSON.parse(typeof msg === "string" ? msg : new TextDecoder().decode(msg));
            } catch {
                ws.close(1003, "Invalid JSON"); // 1003 = Unsupported Data
                return;
            }

            // Validar schema
            if (!parsed.type || typeof parsed.type !== "string") {
                ws.send(JSON.stringify({ error: "Invalid message format" }));
                return;
            }

            // Processar por tipo
            handleMessage(ws, parsed);
        },
    },
});
```

---

## Exercises

### Ex H3.1 — Chat Seguro

```typescript
// Implemente um chat WebSocket com seguranca basica
const sessions = new Map<string, { name: string; room: string }>();

const server = Bun.serve({
    port: 3001,
    fetch(req, server) {
        const url = new URL(req.url);
        const room = url.searchParams.get("room") ?? "default";
        const name = url.searchParams.get("name");

        if (!name || !/^[a-zA-Z0-9_]{1,20}$/.test(name)) {
            return new Response("Nome invalido", { status: 400 });
        }

        // Validar origem
        const origin = req.headers.get("Origin");
        if (origin && !["null", "http://localhost:3000"].includes(origin)) {
            return new Response("Forbidden", { status: 403 });
        }

        const id = crypto.randomUUID();
        server.upgrade(req, { data: { id, name, room } });
        return;
    },
    websocket: {
        maxPayloadLength: 1024,
        open(ws) {
            sessions.set(ws.data.id, { name: ws.data.name, room: ws.data.room });
            ws.subscribe(ws.data.room);
            server.publish(ws.data.room, JSON.stringify({
                type: "join", name: ws.data.name
            }));
        },
        message(ws, msg) {
            const text = typeof msg === "string" ? msg : new TextDecoder().decode(msg);
            if (text.length > 500) { ws.close(1009); return; }

            server.publish(ws.data.room, JSON.stringify({
                type: "message",
                from: ws.data.name,
                text: text.replace(/[<>]/g, ""), // sanitizar HTML
            }));
        },
        close(ws) {
            sessions.delete(ws.data.id);
            server.publish(ws.data.room, JSON.stringify({
                type: "leave", name: ws.data.name
            }));
        },
    },
});
```

### Ex H3.2 — CSWSH Test

```bash
# Testar CSWSH com origem maliciosa
cat > /tmp/cswsh_test.js << 'EOF'
const ws = new WebSocket("ws://localhost:3001", {
    headers: {
        "Origin": "https://evil.com"
    }
});

ws.onopen = () => console.log("VULNERAVEL: conexao aceita de evil.com!");
ws.onerror = (e) => console.log("SEGURO: conexao rejeitada");
setTimeout(() => ws.close(), 1000);
EOF
bun /tmp/cswsh_test.js
```

### Ex H3.3 — Message Flood

```javascript
// Testar rate limiting via WebSocket
const ws = new WebSocket("ws://localhost:3001?name=flood&room=test");

ws.onopen = () => {
    console.log("Conectado. Iniciando flood...");
    let count = 0;
    const interval = setInterval(() => {
        ws.send("X".repeat(100));
        count++;
        if (count >= 1000) {
            clearInterval(interval);
            console.log(`Enviou ${count} mensagens`);
        }
    }, 1);
};

ws.onclose = (e) => console.log(`Fechado: ${e.code} ${e.reason}`);
```

---

## Checkpoint

[ ] Servidor WebSocket funcionando com Bun.serve
[ ] Implementou pub/sub com server.publish
[ ] Validou Origin para prevenir CSWSH
[ ] Implementou limite de tamanho de mensagem
[ ] Testou flood de mensagens

---

## Next

→ [`04-tls`](../04-tls/) — TLS/HTTPS no Bun
