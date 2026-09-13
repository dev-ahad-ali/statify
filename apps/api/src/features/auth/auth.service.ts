import { SignJWT } from "jose";
import { loginSchema, signupSchema } from "@statify/shared";
import { runtimeEnv } from "../../config/env.js";
import { hashPassword, randomId, sha256Hex, verifyPassword } from "../../lib/crypto.js";
import { AuthRepository, type UserRow } from "./auth.repository.js";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
export const AUTH_ERROR = "Invalid email or password";

export class AuthConflictError extends Error {}

export type AuthResult = {
  user: ReturnType<typeof serializeUser>;
  accessToken: string;
  refreshToken: string;
};

function serializeUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

async function createToken(userId: string, type: "access" | "refresh", secret: string, ttl: number) {
  return new SignJWT({ sub: userId, type })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(new TextEncoder().encode(secret));
}

async function createAuthResult(repository: AuthRepository, user: UserRow): Promise<AuthResult> {
  if (!runtimeEnv.ACCESS_TOKEN_SECRET || !runtimeEnv.REFRESH_TOKEN_SECRET) {
    throw new Error("JWT secrets are not configured");
  }

  const accessToken = await createToken(user.id, "access", runtimeEnv.ACCESS_TOKEN_SECRET, ACCESS_TOKEN_TTL_SECONDS);
  const refreshToken = await createToken(user.id, "refresh", runtimeEnv.REFRESH_TOKEN_SECRET, REFRESH_TOKEN_TTL_SECONDS);
  const now = Date.now();
  await repository.insertRefreshToken(
    randomId(),
    user.id,
    await sha256Hex(refreshToken),
    now + REFRESH_TOKEN_TTL_SECONDS * 1000,
    now,
  );

  return { user: serializeUser(user), accessToken, refreshToken };
}

export async function signup(repository: AuthRepository, input: unknown) {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "invalid" as const, error: parsed.error.issues[0]?.message ?? "Invalid request" };
  }

  const email = parsed.data.email.toLowerCase();
  if (await repository.findUserByEmail(email)) throw new AuthConflictError("An account with that email already exists");

  const now = Date.now();
  const user: UserRow = {
    id: randomId(),
    email,
    password_hash: await hashPassword(parsed.data.password),
    name: parsed.data.name,
    created_at: now,
    updated_at: now,
  };

  try {
    await repository.insertUser(user);
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) {
      throw new AuthConflictError("An account with that email already exists");
    }
    throw error;
  }

  return { kind: "success" as const, result: await createAuthResult(repository, user) };
}

export async function login(repository: AuthRepository, input: unknown) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { kind: "invalid" as const };

  const email = parsed.data.email.toLowerCase();
  const user = await repository.findUserByEmail(email);
  const passwordValid = await verifyPassword(parsed.data.password, user?.password_hash ?? `${"00".repeat(16)}:${"00".repeat(32)}`);
  if (!user || !passwordValid) return { kind: "invalid" as const };

  return { kind: "success" as const, result: await createAuthResult(repository, user) };
}
