import { apiDelete, apiGet, apiPatch, apiPost, type ApiResult } from "./api";

export type WebProject = {
  id: string;
  name: string;
  domain: string;
  api_key: string;
  allowed_domains: string[];
};

export function getProjects(): Promise<ApiResult<WebProject[]>> {
  return apiGet<WebProject[]>("/projects");
}

export function createProject(input: {
  name: string;
  domain: string;
}): Promise<ApiResult<WebProject>> {
  return apiPost<WebProject>("/projects", { ...input, allowed_domains: [] });
}

export function updateProject(
  id: string,
  input: { name?: string; allowed_domains?: string[] },
): Promise<ApiResult<WebProject>> {
  return apiPatch<WebProject>(`/projects/${encodeURIComponent(id)}`, input);
}

export function rotateProjectKey(id: string): Promise<ApiResult<WebProject>> {
  return apiPost<WebProject>(`/projects/${encodeURIComponent(id)}/rotate-key`);
}

export function deleteProject(id: string): Promise<ApiResult<null>> {
  return apiDelete<null>(`/projects/${encodeURIComponent(id)}`);
}
