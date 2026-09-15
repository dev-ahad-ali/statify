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

export function getDashboard(projectId: string, range: string): Promise<ApiResult<DashboardData>> {
  return apiGet<DashboardData>(`/dashboard/${encodeURIComponent(projectId)}?range=${encodeURIComponent(range)}`);
}
