import { randomBytes } from "node:crypto";
import { argon2id, argon2Verify } from "hash-wasm";

const OPTIONS = {
  parallelism: 1,
  iterations: 2,
  memorySize: 19456,
  hashLength: 32,
  outputType: "encoded" as const,
};

export async function hashPassword(password: string): Promise<string> {
  return argon2id({
    ...OPTIONS,
    password,
    salt: randomBytes(16),
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return argon2Verify({ password, hash });
}
