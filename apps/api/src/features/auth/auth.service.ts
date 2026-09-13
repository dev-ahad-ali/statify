import { jwtVerify, SignJWT } from "jose";
import { loginSchema, signupSchema } from "@statify/shared";
import { runtimeEnv } from "../../config/env.js";
import { hashPassword, randomId, sha256Hex, verifyPassword } from "../../lib/crypto.js";
import { AuthRepository, type UserRow } from "./auth.repository.js";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
export const AUTH_ERROR = "Invalid email or password";

export class AuthConflictError extends Error {}
export class InvalidRefreshTokenError extends Error {}

export type AuthResult = {
  user: ReturnType<typeof serializeUser>;
  accessToken: string;
  refreshToken: string;
};

function serializeUser(user: UserRow) {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.created_at, updatedAt: user.updated_at };
}

async function createToken(userId: string, type: "access" | "refresh", secret: string, ttl: number) {
  return new SignJWT({ sub: userId, type })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(randomId())
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(new TextEncoder().encode(secret));
}

async function createTokens(userId: string) {
  if (!runtimeEnv.ACCESS_TOKEN_SECRET || !runtimeEnv.REFRESH_TOKEN_SECRET) throw new Error("JWT secrets are not configured");
  return {
    accessToken: await createToken(userId, "access", runtimeEnv.ACCESS_TOKEN_SECRET, ACCESS_TOKEN_TTL_SECONDS),
    refreshToken: await createToken(userId, "refresh", runtimeEnv.REFRESH_TOKEN_SECRET, REFRESH_TOKEN_TTL_SECONDS),
  };
}

async function createAuthResult(repository: AuthRepository, user: UserRow): Promise<AuthResult> {
  const tokens = await createTokens(user.id);
  const now = Date.now();
  await repository.insertRefreshToken(
    randomId(),
    user.id,
    await sha256Hex(tokens.refreshToken),
    now + REFRESH_TOKEN_TTL_SECONDS * 1000,
    now,
  );
  return { user: serializeUser(user), ...tokens };
}

export async function signup(repository: AuthRepository, input: unknown) {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { kind: "invalid" as const, error: parsed.error.issues[0]?.message ?? "Invalid request" };

  const email = parsed.data.email.toLowerCase();
  if (await repository.findUserByEmail(email)) throw new AuthConflictError("An account with that email already exists");

  const now = Date.now();
  const user: UserRow = {
    id: randomId(), email, password_hash: await hashPassword(parsed.data.password), name: parsed.data.name,
    created_at: now, updated_at: now,
  };

  try {
    await repository.insertUser(user);
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) throw new AuthConflictError("An account with that email already exists");
    throw error;
  }
  return { kind: "success" as const, result: await createAuthResult(repository, user) };
}

export async function login(repository: AuthRepository, input: unknown) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { kind: "invalid" as const };

  const user = await repository.findUserByEmail(parsed.data.email.toLowerCase());
  const passwordValid = await verifyPassword(parsed.data.password, user?.password_hash ?? `${"00".repeat(16)}:${"00".repeat(32)}`);
  if (!user || !passwordValid) return { kind: "invalid" as const };
  return { kind: "success" as const, result: await createAuthResult(repository, user) };
}

export async function refresh(repository: AuthRepository, token: string) {
  if (!runtimeEnv.REFRESH_TOKEN_SECRET) throw new Error("JWT secrets are not configured");

  let payload;
  try {
    ({ payload } = await jwtVerify(token, new TextEncoder().encode(runtimeEnv.REFRESH_TOKEN_SECRET), { algorithms: ["HS256"] }));
  } catch {
    throw new InvalidRefreshTokenError("Invalid refresh token");
  }
  if (payload.type !== "refresh" || typeof payload.sub !== "string") throw new InvalidRefreshTokenError("Invalid refresh token");

  const oldHash = await sha256Hex(token);
  const storedToken = await repository.findRefreshToken(oldHash);
  if (!storedToken) {
    await repository.deleteRefreshTokensForUser(payload.sub);
    throw new InvalidRefreshTokenError("Refresh token reuse detected");
  }
  if (storedToken.user_id !== payload.sub || storedToken.expires_at <= Date.now()) {
    await repository.deleteRefreshTokensForUser(payload.sub);
    throw new InvalidRefreshTokenError("Invalid refresh token");
  }

  const user = await repository.findUserById(payload.sub);
  if (!user) throw new InvalidRefreshTokenError("Invalid refresh token");

  const tokens = await createTokens(user.id);
  const now = Date.now();
  await repository.rotateRefreshToken(
    oldHash, randomId(), user.id, await sha256Hex(tokens.refreshToken),
    now + REFRESH_TOKEN_TTL_SECONDS * 1000, now,
  );
  return { user: serializeUser(user), ...tokens };
}

export async function authenticateAccessToken(token: string) {
  if (!runtimeEnv.ACCESS_TOKEN_SECRET) throw new Error("JWT secrets are not configured");
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(runtimeEnv.ACCESS_TOKEN_SECRET), { algorithms: ["HS256"] });
    if (payload.type !== "access" || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export async function forgotPassword(repository: AuthRepository, email: string) {
  const user = await repository.findUserByEmail(email.toLowerCase());
  if (!user) return;
  const token = bytesToToken(crypto.getRandomValues(new Uint8Array(32)));
  await repository.insertResetToken(randomId(), user.id, await sha256Hex(token), Date.now() + 30 * 60 * 1000);
  await sendResetEmail(user.email, token);
}

function bytesToToken(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sendResetEmail(email: string, token: string) {
  if (!runtimeEnv.RESEND_API_KEY || !runtimeEnv.WEB_URL) throw new Error("Password reset email is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${runtimeEnv.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Statify <onboarding@resend.dev>", to: [email], subject: "Reset your Statify password",
      html: resetEmailHtml(`${runtimeEnv.WEB_URL}/reset/${token}`),
    }),
  });
  if (!response.ok) throw new Error(`Resend request failed with ${response.status}`);
}

function resetEmailHtml(link: string) {
  return `<p>We received a request to reset your Statify password.</p><p><a href="${link}">Reset your password</a></p><p>This link expires in 30 minutes.</p>`;
}

export async function resetPassword(repository: AuthRepository, token: string, password: string) {
  const parsed = signupSchema.shape.password.safeParse(password);
  if (!parsed.success) return false;

  const tokenHash = await sha256Hex(token);
  const resetToken = await repository.findResetToken(tokenHash);
  if (!resetToken || resetToken.used_at !== null || resetToken.expires_at <= Date.now()) return false;

  await repository.consumeResetToken(tokenHash, resetToken.user_id, Date.now(), await hashPassword(password), Date.now());
  return true;
}
