import { apiGet, apiPost, type ApiResult } from "./api";

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

export function createProject(input: { name: string; domain: string }): Promise<ApiResult<WebProject>> {
  return apiPost<WebProject>("/projects", { ...input, allowed_domains: [] });
}
