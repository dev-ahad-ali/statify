export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T | null;
  error: string | null;
};

export type ApiResult<T> = {
  data: T | null;
  error: string | null;
  status: number;
};

let refreshPromise: Promise<boolean> | null = null;

function apiPath(path: string) {
  return path.startsWith("/") ? `/api${path}` : `/api/${path}`;
}

async function parseResponse<T>(response: Response): Promise<ApiResult<T>> {
  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    body = null;
  }

  return {
    data: response.ok ? (body?.data ?? null) : null,
    error: response.ok ? null : body?.error ?? body?.message ?? `Request failed with status ${response.status}`,
    status: response.status,
  };
}

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetch(apiPath("/auth/refresh"), {
      method: "POST",
      credentials: "include",
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, canRefresh = true): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(apiPath(path), {
      ...init,
      credentials: "include",
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    return { data: null, error: "Unable to reach the Statify API", status: 0 };
  }

  if (response.status === 401 && canRefresh && !path.startsWith("/auth/")) {
    if (await refreshSession()) return apiFetch<T>(path, init, false);
    if (typeof window !== "undefined") window.location.assign("/login");
  }

  return parseResponse<T>(response);
}

export function apiGet<T>(path: string) {
  return apiFetch<T>(path);
}

export function apiPost<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function apiPatch<T>(path: string, body: unknown) {
  return apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export function apiDelete<T>(path: string) {
  return apiFetch<T>(path, { method: "DELETE" });
}
