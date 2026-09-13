import express, { type NextFunction, type Request, type Response } from "express";
import { httpServerHandler } from "cloudflare:node";
import { env } from "cloudflare:workers";
import { SignJWT } from "jose";
import { loginSchema, signupSchema } from "@statify/shared";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_LENGTH = 256;
const AUTH_ERROR = "Invalid email or password";
const DUMMY_PASSWORD_HASH = `${"00".repeat(16)}:${"00".repeat(32)}`;

type RuntimeEnv = Env & {
  ACCESS_TOKEN_SECRET: string;
  REFRESH_TOKEN_SECRET: string;
  ENVIRONMENT?: string;
};

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: number;
  updated_at: number;
};

const runtimeEnv = env as unknown as RuntimeEnv;

function success<T>(res: Response, message: string, data: T, status = 200) {
  return res.status(status).json({ success: true, message, data, error: null });
}

function failure(res: Response, message: string, status: number, error = message) {
  return res.status(status).json({ success: false, message, data: null, error });
}

function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) throw new Error("Invalid hex value");

  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function derivePasswordHash(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt.buffer as ArrayBuffer, iterations: PBKDF2_ITERATIONS },
    key,
    PBKDF2_KEY_LENGTH,
  );
  return new Uint8Array(bits);
}

async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${bytesToHex(salt)}:${bytesToHex(await derivePasswordHash(password, salt))}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [saltHex, hashHex] = storedHash.split(":");
  let salt: Uint8Array;
  let expected: Uint8Array;

  try {
    salt = hexToBytes(saltHex ?? "");
    expected = hexToBytes(hashHex ?? "");
  } catch {
    const [dummySalt, dummyHash] = DUMMY_PASSWORD_HASH.split(":");
    salt = hexToBytes(dummySalt ?? "");
    expected = hexToBytes(dummyHash ?? "");
  }

  const actual = await derivePasswordHash(password, salt);
  if (actual.length !== expected.length) return false;

  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= (actual[index] ?? 0) ^ (expected[index] ?? 0);
  return difference === 0;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function createToken(userId: string, type: "access" | "refresh", secret: string, ttl: number) {
  return new SignJWT({ sub: userId, type })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(new TextEncoder().encode(secret));
}

function userData(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const secure = runtimeEnv.ENVIRONMENT === "production";
  const suffix = `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
  res.append("Set-Cookie", `access_token=${accessToken}; Max-Age=${ACCESS_TOKEN_TTL_SECONDS}; ${suffix}`);
  res.append("Set-Cookie", `refresh_token=${refreshToken}; Max-Age=${REFRESH_TOKEN_TTL_SECONDS}; ${suffix}`);
}

async function issueTokens(user: UserRow, res: Response) {
  if (!runtimeEnv.ACCESS_TOKEN_SECRET || !runtimeEnv.REFRESH_TOKEN_SECRET) {
    throw new Error("JWT secrets are not configured");
  }

  const accessToken = await createToken(user.id, "access", runtimeEnv.ACCESS_TOKEN_SECRET, ACCESS_TOKEN_TTL_SECONDS);
  const refreshToken = await createToken(user.id, "refresh", runtimeEnv.REFRESH_TOKEN_SECRET, REFRESH_TOKEN_TTL_SECONDS);
  const now = Date.now();
  const tokenHash = await sha256Hex(refreshToken);

  await runtimeEnv.DB.prepare(
    "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(randomId(), user.id, tokenHash, now + REFRESH_TOKEN_TTL_SECONDS * 1000, now)
    .run();

  setAuthCookies(res, accessToken, refreshToken);
}

const app = express();
app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) => success(res, "API is healthy", { status: "ok" }));

app.post("/auth/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, "Invalid signup data", 400, parsed.error.issues[0]?.message ?? "Invalid request");
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await runtimeEnv.DB.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE")
    .bind(email)
    .first<{ id: string }>();
  if (existing) return failure(res, "An account with that email already exists", 409);

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
    await runtimeEnv.DB.prepare(
      "INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(user.id, user.email, user.password_hash, user.name, user.created_at, user.updated_at)
      .run();
    await issueTokens(user, res);
    return success(res, "Account created", userData(user), 201);
  } catch (error) {
    console.error("signup failed", error);
    return failure(res, "Unable to create account", 500);
  }
});

app.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return failure(res, AUTH_ERROR, 401);

  const email = parsed.data.email.toLowerCase();
  const user = await runtimeEnv.DB.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
    .bind(email)
    .first<UserRow>();
  const passwordValid = await verifyPassword(parsed.data.password, user?.password_hash ?? DUMMY_PASSWORD_HASH);

  if (!user || !passwordValid) return failure(res, AUTH_ERROR, 401);

  try {
    await issueTokens(user, res);
    return success(res, "Login successful", userData(user));
  } catch (error) {
    console.error("login failed", error);
    return failure(res, "Unable to log in", 500);
  }
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("request failed", err);
  return failure(res, "Internal server error", 500);
});

const server = app.listen(8787);
export default httpServerHandler({ port: 8787 });
