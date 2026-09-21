import { apiGet, apiPost, type ApiResult } from "./api";

export type AuditCheck = {
  key: string;
  label: string;
  passed: boolean;
  weight: number;
  note: string;
};
export type Audit = {
  id: string;
  projectId: string;
  url: string;
  ranAt: number;
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
  agentic: number | null;
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
  raw: { agentic?: { checks?: AuditCheck[] } } | null;
};
export type FieldVital = { count: number; mean: number | null };
export type AuditsResponse = {
  audits: Audit[];
  field: Partial<Record<"LCP" | "INP" | "CLS", FieldVital>>;
};

export function getAudits(
  projectId: string,
  limit = 30,
): Promise<ApiResult<AuditsResponse>> {
  return apiGet<AuditsResponse>(
    `/audits/${encodeURIComponent(projectId)}?limit=${limit}`,
  );
}
export function runAudit(projectId: string): Promise<ApiResult<null>> {
  return apiPost<null>(`/audits/${encodeURIComponent(projectId)}/run`);
}
