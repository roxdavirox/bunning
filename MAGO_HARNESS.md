# MAGO_HARNESS — Bun como Runtime para Orquestracao de Agentes

> Como usar Bun para criar um harness ultra-rapido para o MAGO system.
>
> Sinergia: zero-day research alimenta seguranca do harness; harness motiva entendimento profundo.

---

## Motivacao

### Por que nao Node.js para harness?

| Problema | Node | Bun |
|----------|------|-----|
| Startup time | ~50-100ms | ~5-10ms |
| Memory baseline | ~30MB | ~10MB |
| IPC overhead | JSON serialize | FFI direto |
| WebSocket | ws package | Built-in |
| TypeScript | ts-node/tsx | Native |

Para orquestracao de agentes:
- **Startup rapido** = mais ciclos por segundo
- **Memoria baixa** = mais agentes simultaneos
- **FFI direto** = integracao com libs performance-critical

---

## Arquitetura Proposta

```
mago-harness-bun/
├── src/
│   ├── main.ts           # Entry point
│   ├── orchestrator.ts   # Agent lifecycle
│   ├── ipc.ts            # Inter-process communication
│   ├── ffi/
│   │   ├── crypto.ts     # Zig crypto bindings
│   │   └── simd.ts       # SIMD operations
│   ├── protocols/
│   │   ├── board.ts      # Board MCP client
│   │   ├── claude.ts     # Claude API client
│   │   └── tools.ts      # Tool definitions
│   └── security/
│       ├── sandbox.ts    # Capability-based isolation
│       └── audit.ts      # Audit chain
├── zig/
│   ├── crypto.zig        # Fast crypto
│   └── simd.zig          # Vector ops
├── tests/
└── benchmarks/
```

---

## Core Components

### 1. Ultra-Fast Agent Loop

```typescript
// src/orchestrator.ts
import { serve, type ServerWebSocket } from "bun";

interface AgentMessage {
  id: string;
  type: "tool_call" | "response" | "error";
  payload: unknown;
}

const agents = new Map<string, ServerWebSocket<AgentMessage>>();

serve({
  port: 5009,
  fetch(req, server) {
    if (server.upgrade(req, { data: { agentId: crypto.randomUUID() } })) {
      return; // upgraded to websocket
    }
    return new Response("MAGO Harness v0.1.0");
  },
  websocket: {
    open(ws) {
      agents.set(ws.data.agentId, ws);
      console.log(`Agent ${ws.data.agentId} connected`);
    },
    message(ws, message) {
      const msg: AgentMessage = JSON.parse(message as string);
      handleAgentMessage(ws.data.agentId, msg);
    },
    close(ws) {
      agents.delete(ws.data.agentId);
    },
  },
});

async function handleAgentMessage(agentId: string, msg: AgentMessage) {
  switch (msg.type) {
    case "tool_call":
      const result = await executeTool(msg.payload);
      agents.get(agentId)?.send(JSON.stringify({ type: "response", ...result }));
      break;
  }
}
```

### 2. FFI para Performance-Critical

```typescript
// src/ffi/crypto.ts
import { dlopen, FFIType, suffix, ptr } from "bun:ffi";

// Carregar lib Zig compilada
const lib = dlopen(`./zig/zig-out/lib/libmago.${suffix}`, {
  // Hash rapido para audit chain
  blake3_hash: {
    args: [FFIType.ptr, FFIType.u64, FFIType.ptr],
    returns: FFIType.void,
  },
  // Encrypt com ChaCha20-Poly1305
  encrypt_chacha: {
    args: [FFIType.ptr, FFIType.u64, FFIType.ptr, FFIType.ptr],
    returns: FFIType.i32,
  },
  // SIMD JSON parse (experimental)
  simd_json_parse: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
});

export function blake3(data: Uint8Array): Uint8Array {
  const output = new Uint8Array(32);
  lib.symbols.blake3_hash(ptr(data), BigInt(data.length), ptr(output));
  return output;
}
```

### 3. Capability-Based Security

```typescript
// src/security/sandbox.ts

// Bun nao tem sandbox nativo, entao criamos capability layer
interface Capabilities {
  filesystem: "none" | "read" | "write" | "full";
  network: "none" | "local" | "full";
  ffi: boolean;
  subprocess: boolean;
}

const DEFAULT_CAPS: Capabilities = {
  filesystem: "none",
  network: "local",
  ffi: false,
  subprocess: false,
};

class SandboxedAgent {
  constructor(
    private id: string,
    private caps: Capabilities
  ) {}

  async readFile(path: string): Promise<string> {
    if (this.caps.filesystem === "none") {
      throw new Error(`Agent ${this.id} lacks filesystem capability`);
    }
    // Validate path is within allowed scope
    const allowed = this.validatePath(path);
    if (!allowed) throw new Error(`Path ${path} outside allowed scope`);
    return Bun.file(path).text();
  }

  async fetch(url: string): Promise<Response> {
    if (this.caps.network === "none") {
      throw new Error(`Agent ${this.id} lacks network capability`);
    }
    if (this.caps.network === "local" && !this.isLocalUrl(url)) {
      throw new Error(`Agent ${this.id} can only access local URLs`);
    }
    return fetch(url);
  }

  private validatePath(path: string): boolean {
    // Implement path validation
    return !path.includes("..") && path.startsWith("/tmp/mago-sandbox/");
  }

  private isLocalUrl(url: string): boolean {
    const u = new URL(url);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  }
}
```

### 4. Audit Chain (Append-Only Log)

```typescript
// src/security/audit.ts
import { blake3 } from "../ffi/crypto";

interface AuditEntry {
  timestamp: number;
  agentId: string;
  action: string;
  payload: unknown;
  prevHash: string;
  hash?: string;
}

const auditChain: AuditEntry[] = [];
let prevHash = "0".repeat(64);

export function audit(agentId: string, action: string, payload: unknown) {
  const entry: AuditEntry = {
    timestamp: Date.now(),
    agentId,
    action,
    payload,
    prevHash,
  };

  // Hash com BLAKE3 via FFI
  const data = new TextEncoder().encode(JSON.stringify(entry));
  const hash = Buffer.from(blake3(data)).toString("hex");
  entry.hash = hash;
  prevHash = hash;

  auditChain.push(entry);

  // Append to file (NDJSON)
  Bun.write(
    Bun.file("audit-chain.ndjson"),
    JSON.stringify(entry) + "\n",
    { append: true }
  );
}
```

---

## Integracao com mago-board

```typescript
// src/protocols/board.ts
import { WebSocket } from "bun";

const BOARD_URL = "ws://127.0.0.1:5008/ws";

class BoardClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, (v: unknown) => void>();

  async connect() {
    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(BOARD_URL);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string);
        const pending = this.pending.get(msg.id);
        if (pending) {
          pending(msg.result);
          this.pending.delete(msg.id);
        }
      };
    });
  }

  async call(method: string, params: unknown): Promise<unknown> {
    const id = crypto.randomUUID();
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.ws?.send(JSON.stringify({ id, method, params }));
    });
  }

  async listItems() {
    return this.call("board_list", {});
  }

  async moveItem(id: string, column: string) {
    return this.call("board_move", { id, column });
  }

  async createItem(data: unknown) {
    return this.call("board_create", data);
  }
}

export const board = new BoardClient();
```

---

## Benchmarks Esperados

| Operation | Node.js | Bun | Speedup |
|-----------|---------|-----|---------|
| Startup | 50ms | 5ms | 10x |
| JSON parse (1MB) | 15ms | 3ms | 5x |
| BLAKE3 hash (FFI) | N/A | 0.5ms | - |
| WebSocket send | 0.2ms | 0.05ms | 4x |
| Agent spawn | 100ms | 10ms | 10x |

---

## Seguranca: Lessons do Zero-Day Research

### O que aprendemos pesquisando Bun

1. **FFI e perigoso** → capability layer obrigatorio
2. **Sem sandbox nativo** → implementar em userspace
3. **JSC JIT** → nao executar codigo de agents untrusted via eval
4. **Install hooks** → `--ignore-scripts` sempre

### Mitigacoes no harness

```typescript
// NUNCA fazer isso com input de agent
eval(agentCode); // PROIBIDO

// SEMPRE usar sandbox
const agent = new SandboxedAgent(id, restrictedCaps);
await agent.executeTask(task); // Capabilities enforced
```

---

## Roadmap

### v0.1 — MVP

- [ ] WebSocket agent loop
- [ ] Board integration
- [ ] Basic capabilities
- [ ] BLAKE3 FFI

### v0.2 — Security

- [ ] Full capability model
- [ ] Audit chain
- [ ] Agent isolation (separate processes)

### v0.3 — Performance

- [ ] SIMD JSON
- [ ] io_uring tuning
- [ ] Zero-copy message passing

### v0.4 — Production

- [ ] Monitoring/metrics
- [ ] Graceful shutdown
- [ ] Agent restart
- [ ] Rate limiting

---

## Cross-Reference

- `STUDY_PATH.md` Fase 4 (FFI) → base para Zig bindings
- `STUDY_PATH.md` Fase 8 (Security) → informa capability model
- `CVE_INTEL.md` → vulnerabilidades a evitar
- `mago-board` MCP → protocolo de integracao
