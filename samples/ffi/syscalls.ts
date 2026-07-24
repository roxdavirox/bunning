/**
 * Raw Syscalls — Chamadas de sistema diretas via FFI
 *
 * Demonstra:
 * - syscall() via libc
 * - Números de syscall x86_64
 * - Operações de baixo nível
 *
 * NOTA: Bypass completo de qualquer abstração!
 */

import { dlopen, FFIType, ptr } from "bun:ffi";

// Syscall numbers (x86_64 Linux)
const SYS = {
  read: 0n,
  write: 1n,
  open: 2n,
  close: 3n,
  stat: 4n,
  fstat: 5n,
  poll: 7n,
  lseek: 8n,
  mmap: 9n,
  mprotect: 10n,
  munmap: 11n,
  brk: 12n,
  getpid: 39n,
  getuid: 102n,
  getgid: 104n,
  geteuid: 107n,
  getegid: 108n,
  uname: 63n,
  getcwd: 79n,
  time: 201n,
  getrandom: 318n,
};

// Carregar libc para syscall()
const libc = dlopen("libc.so.6", {
  syscall: {
    args: [FFIType.i64], // variadic, mas declaramos só o número
    returns: FFIType.i64,
  },
  // Para syscalls com argumentos, precisamos de funções específicas
  syscall1: {
    args: [FFIType.i64, FFIType.i64],
    returns: FFIType.i64,
  },
  syscall2: {
    args: [FFIType.i64, FFIType.i64, FFIType.i64],
    returns: FFIType.i64,
  },
  syscall3: {
    args: [FFIType.i64, FFIType.i64, FFIType.i64, FFIType.i64],
    returns: FFIType.i64,
  },
});

// Wrapper para syscall sem args
function syscall0(nr: bigint): bigint {
  return libc.symbols.syscall(nr);
}

console.log("=== Raw Syscalls Demo ===\n");

// getpid (syscall 39)
const pid = syscall0(SYS.getpid);
console.log("SYS_getpid (39):", pid);

// getuid (syscall 102)
const uid = syscall0(SYS.getuid);
console.log("SYS_getuid (102):", uid);

// geteuid (syscall 107)
const euid = syscall0(SYS.geteuid);
console.log("SYS_geteuid (107):", euid);

// getgid (syscall 104)
const gid = syscall0(SYS.getgid);
console.log("SYS_getgid (104):", gid);

// Comparar com process
console.log("\nBun process comparison:");
console.log("  process.pid:", process.pid);
console.log("  syscall pid:", pid);
console.log("  Match:", BigInt(process.pid) === pid ? "YES" : "NO");

console.log("\n=== Security Implications ===");
console.log("Raw syscalls bypass ALL userspace abstractions.");
console.log("An attacker with FFI access could:");
console.log("  - Read/write arbitrary memory (mmap + read/write)");
console.log("  - Execute arbitrary programs (execve)");
console.log("  - Modify file permissions (chmod)");
console.log("  - Create network connections (socket)");
console.log("  - And much more...");
