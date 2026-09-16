import { apiGet, type ApiResult } from "./api";

export type DashboardRange = {
  from: string;
  to: string;
  chartFrom: string;
  chartTo: string;
};

export type DashboardData = {
  projectId: string;
  range: DashboardRange;
  views: {
    pageView: "top" | "entry";
    locationView: "country" | "region" | "city";
    deviceView: "browser" | "os" | "device";
  };
  filtered: boolean;
  summary: {
    pageviews: number;
    visitors: number;
    sessions: number;
  };
  chart: Array<{ date: string; visitors: number; pageviews: number }>;
  pages: Array<{ dimension: string; views: number }>;
  referrers: Array<{ dimension: string; views: number }>;
  locations: Array<{ dimension: string; views: number }>;
  devices: Array<{ dimension: string; views: number }>;
};

export type DashboardParams = {
  range: string;
  pageView?: "top" | "entry";
  locationView?: "country" | "region" | "city";
  deviceView?: "browser" | "os" | "device";
  page?: string;
  referrer?: string;
  country?: string;
  browser?: string;
  os?: string;
  device?: string;
};

export function getDashboard(projectId: string, params: DashboardParams): Promise<ApiResult<DashboardData>> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, value); });
  return apiGet<DashboardData>(`/dashboard/${encodeURIComponent(projectId)}?${query.toString()}`);
}
