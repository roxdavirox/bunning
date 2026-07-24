/**
 * libc Direct Access — Chamar funções da libc diretamente
 *
 * Demonstra:
 * - Acesso a funções do sistema
 * - Manipulação de ponteiros
 * - CString para strings C
 *
 * NOTA: Isso demonstra por que FFI é perigoso - acesso total ao sistema!
 */

import { dlopen, FFIType, ptr, CString } from "bun:ffi";

// Carregar libc
const libc = dlopen("libc.so.6", {
  // Process info
  getpid: { args: [], returns: FFIType.i32 },
  getppid: { args: [], returns: FFIType.i32 },
  getuid: { args: [], returns: FFIType.i32 },
  geteuid: { args: [], returns: FFIType.i32 },
  getgid: { args: [], returns: FFIType.i32 },

  // Environment
  getenv: { args: [FFIType.cstring], returns: FFIType.ptr },

  // Hostname
  gethostname: { args: [FFIType.ptr, FFIType.u64], returns: FFIType.i32 },

  // Time
  time: { args: [FFIType.ptr], returns: FFIType.i64 },

  // Random
  rand: { args: [], returns: FFIType.i32 },
  srand: { args: [FFIType.u32], returns: FFIType.void },

  // String
  strlen: { args: [FFIType.cstring], returns: FFIType.u64 },
});

console.log("=== libc Direct Access ===\n");

// Process info
console.log("Process Info:");
console.log("  PID:", libc.symbols.getpid());
console.log("  PPID:", libc.symbols.getppid());
console.log("  UID:", libc.symbols.getuid());
console.log("  EUID:", libc.symbols.geteuid());
console.log("  GID:", libc.symbols.getgid());

// Environment variables
console.log("\nEnvironment:");
const envVars = ["HOME", "USER", "SHELL", "PATH"];
for (const name of envVars) {
  const valuePtr = libc.symbols.getenv(name);
  if (valuePtr) {
    const value = new CString(valuePtr);
    const display =
      name === "PATH"
        ? value.toString().substring(0, 50) + "..."
        : value.toString();
    console.log(`  ${name}=${display}`);
  }
}

// Hostname
const hostbuf = new Uint8Array(256);
libc.symbols.gethostname(ptr(hostbuf), BigInt(hostbuf.length));
const hostname = new CString(ptr(hostbuf));
console.log("\nHostname:", hostname.toString());

// Time
const timestamp = libc.symbols.time(null);
console.log("Unix timestamp:", timestamp);
console.log("Date:", new Date(Number(timestamp) * 1000).toISOString());

// Random
libc.symbols.srand(Number(timestamp));
console.log("\nRandom numbers:");
for (let i = 0; i < 5; i++) {
  console.log("  rand() =", libc.symbols.rand());
}

// String length
const testStr = "Hello from Bun FFI!";
console.log("\nString length:");
console.log(`  strlen("${testStr}") =`, libc.symbols.strlen(testStr));

console.log("\n=== Security Note ===");
console.log("FFI gives FULL access to libc - no sandbox!");
console.log("Any code with FFI access can do ANYTHING the process can do.");
