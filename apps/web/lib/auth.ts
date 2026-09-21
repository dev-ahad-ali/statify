import { apiGet, apiPost, type ApiResult } from "./api";

export type User = {
  id: string;
  email: string;
  name: string;
};

export type AuthResponse = User;

export function getCurrentUser(): Promise<ApiResult<User>> {
  return apiGet<User>("/auth/me");
}

export function login(input: { email: string; password: string }) {
  return apiPost<AuthResponse>("/auth/login", input);
}

export function signup(input: {
  email: string;
  password: string;
  name: string;
}) {
  return apiPost<AuthResponse>("/auth/signup", input);
}

export function forgotPassword(email: string) {
  return apiPost<null>("/auth/forgot", { email });
}

export function resetPassword(input: { token: string; password: string }) {
  return apiPost<null>("/auth/reset", input);
}

export function logout() {
  return apiPost<null>("/auth/logout");
}
