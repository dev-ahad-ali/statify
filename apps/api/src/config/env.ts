import { env } from "cloudflare:workers";

export type RuntimeEnv = Env & {
  ACCESS_TOKEN_SECRET: string;
  REFRESH_TOKEN_SECRET: string;
  RESEND_API_KEY?: string;
  WEB_URL?: string;
  ENVIRONMENT?: string;
};

export const runtimeEnv = env as unknown as RuntimeEnv;
