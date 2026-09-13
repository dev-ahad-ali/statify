import { env } from "cloudflare:workers";

export type RuntimeEnv = Env & {
  ACCESS_TOKEN_SECRET: string;
  REFRESH_TOKEN_SECRET: string;
  ENVIRONMENT?: string;
};

export const runtimeEnv = env as unknown as RuntimeEnv;
