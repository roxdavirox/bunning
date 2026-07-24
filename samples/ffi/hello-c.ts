/**
 * FFI Básico — Carregar biblioteca C e chamar funções
 *
 * Demonstra:
 * - dlopen para carregar .so
 * - FFIType para declarar tipos
 * - Chamada de funções nativas
 */

import { dlopen, FFIType, suffix, ptr } from "bun:ffi";
import { existsSync, writeFileSync, unlinkSync } from "fs";
import { execSync } from "child_process";

// Criar biblioteca C temporária
const cCode = `
#include <stdio.h>
#include <string.h>

int add(int a, int b) {
    return a + b;
}

int multiply(int a, int b) {
    return a * b;
}

int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

void greet(const char* name) {
    printf("Hello, %s!\\n", name);
}

int string_length(const char* s) {
    return strlen(s);
}
`;

const libPath = "/tmp/libhello.so";
const cPath = "/tmp/hello.c";

// Compilar se não existe
if (!existsSync(libPath)) {
  console.log("Compiling C library...");
  writeFileSync(cPath, cCode);
  execSync(`gcc -shared -fPIC -o ${libPath} ${cPath}`);
  console.log("Done!\n");
}

// Carregar biblioteca
const lib = dlopen(libPath, {
  add: {
    args: [FFIType.i32, FFIType.i32],
    returns: FFIType.i32,
  },
  multiply: {
    args: [FFIType.i32, FFIType.i32],
    returns: FFIType.i32,
  },
  factorial: {
    args: [FFIType.i32],
    returns: FFIType.i32,
  },
  greet: {
    args: [FFIType.cstring],
    returns: FFIType.void,
  },
  string_length: {
    args: [FFIType.cstring],
    returns: FFIType.i32,
  },
});

// Testar funções
console.log("=== FFI Demo ===\n");

console.log("add(2, 3) =", lib.symbols.add(2, 3));
console.log("multiply(4, 5) =", lib.symbols.multiply(4, 5));
console.log("factorial(10) =", lib.symbols.factorial(10));

console.log("\nstring_length('hello') =", lib.symbols.string_length("hello"));

console.log("\nCalling greet('Bun FFI'):");
lib.symbols.greet("Bun FFI");

console.log("\n=== Done ===");
