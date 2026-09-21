export type DashboardRange = {
  from: string;
  to: string;
  chartFrom: string;
  chartTo: string;
};

export type DashboardFilters = {
  page?: string;
  referrer?: string;
  country?: string;
  browser?: string;
  os?: string;
  device?: string;
};

export type DashboardOptions = {
  range: DashboardRange;
  pageView: "top" | "entry";
  locationView: "country" | "region" | "city";
  deviceView: "browser" | "os" | "device";
  filters: DashboardFilters;
};

type SummaryRow = {
  visitors: number | null;
  pageviews: number | null;
  sessions: number | null;
};
type ChartRow = {
  date: string;
  visitors: number | null;
  pageviews: number | null;
};
type DimensionRow = { dimension: string; views: number | null };

function startOfDay(date: string) {
  return `${date}T00:00:00.000Z`;
}

function endExclusive(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString();
}

function eventWhere(range: DashboardRange, filters: DashboardFilters) {
  const clauses = [
    "project_id = ?",
    "type = 'page_view'",
    "timestamp >= ?",
    "timestamp < ?",
  ];
  const values: unknown[] = [
    range.from,
    Date.parse(startOfDay(range.from)),
    Date.parse(endExclusive(range.to)),
  ];
  const entries: Array<[keyof DashboardFilters, string]> = [
    ["page", "path"],
    ["referrer", "referrer"],
    ["country", "country"],
    ["browser", "browser"],
    ["os", "os"],
    ["device", "device"],
  ];
  for (const [key, column] of entries) {
    const value = filters[key];
    if (value !== undefined) {
      clauses.push(`${column} = ?`);
      values.push(value);
    }
  }
  return { sql: clauses.join(" AND "), values };
}

function bind<T>(statement: D1PreparedStatement, values: unknown[]) {
  return statement.bind(...values).all<T>();
}

export class DashboardRepository {
  constructor(private readonly db: D1Database) {}

  findOwnedProject(projectId: string, ownerId: string) {
    return this.db
      .prepare(
        "SELECT id FROM projects WHERE id = ? AND owner_id = ? AND is_active = 1",
      )
      .bind(projectId, ownerId)
      .first<{ id: string }>();
  }

  async fromRollups(projectId: string, options: DashboardOptions) {
    const { range, pageView, locationView, deviceView } = options;
    const dateValues = [projectId, range.from, range.to];
    const chartValues = [projectId, range.chartFrom, range.chartTo];
    const locationTable = {
      country: "daily_countries",
      region: "daily_regions",
      city: "daily_cities",
    }[locationView];
    const locationColumn = {
      country: "country_code",
      region: "region",
      city: "city",
    }[locationView];
    const deviceTable = {
      browser: "daily_browsers",
      os: "daily_os",
      device: "daily_devices",
    }[deviceView];
    const deviceColumn = deviceView;
    const pageColumn = pageView === "entry" ? "entries" : "pageviews";

    const [summary, chart, pages, referrers, locations, devices] =
      await Promise.all([
        bind<SummaryRow>(
          this.db.prepare(
            "SELECT COALESCE(SUM(pageviews), 0) AS pageviews, COALESCE(SUM(visitors), 0) AS visitors, COALESCE(SUM(sessions), 0) AS sessions FROM daily_stats WHERE project_id = ? AND date BETWEEN ? AND ?",
          ),
          dateValues,
        ),
        bind<ChartRow>(
          this.db.prepare(
            "SELECT date, visitors, pageviews FROM daily_stats WHERE project_id = ? AND date BETWEEN ? AND ? ORDER BY date ASC",
          ),
          chartValues,
        ),
        bind<DimensionRow>(
          this.db.prepare(
            `SELECT path AS dimension, COALESCE(SUM(${pageColumn}), 0) AS views FROM daily_pages WHERE project_id = ? AND date BETWEEN ? AND ? GROUP BY path ORDER BY views DESC, path ASC LIMIT 50`,
          ),
          dateValues,
        ),
        bind<DimensionRow>(
          this.db.prepare(
            "SELECT referrer AS dimension, COALESCE(SUM(pageviews), 0) AS views FROM daily_referrers WHERE project_id = ? AND date BETWEEN ? AND ? GROUP BY referrer ORDER BY views DESC, referrer ASC LIMIT 50",
          ),
          dateValues,
        ),
        bind<DimensionRow>(
          this.db.prepare(
            `SELECT ${locationColumn} AS dimension, COALESCE(SUM(visitors), 0) AS views FROM ${locationTable} WHERE project_id = ? AND date BETWEEN ? AND ? GROUP BY ${locationColumn} ORDER BY views DESC, dimension ASC LIMIT 50`,
          ),
          dateValues,
        ),
        bind<DimensionRow>(
          this.db.prepare(
            `SELECT ${deviceColumn} AS dimension, COALESCE(SUM(visitors), 0) AS views FROM ${deviceTable} WHERE project_id = ? AND date BETWEEN ? AND ? GROUP BY ${deviceColumn} ORDER BY views DESC, dimension ASC LIMIT 50`,
          ),
          dateValues,
        ),
      ]);
    return {
      summary: summary.results[0] ?? { visitors: 0, pageviews: 0, sessions: 0 },
      chart: chart.results,
      pages: pages.results,
      referrers: referrers.results,
      locations: locations.results,
      devices: devices.results,
    };
  }

  async fromEvents(projectId: string, options: DashboardOptions) {
    const { range, pageView, locationView, deviceView, filters } = options;
    const where = eventWhere(range, filters);
    const values = [projectId, ...where.values.slice(1)];
    const chartWhere = eventWhere(
      { ...range, from: range.chartFrom, to: range.chartTo },
      filters,
    );
    const chartValues = [projectId, ...chartWhere.values.slice(1)];
    const locationColumn = {
      country: "country",
      region: "region",
      city: "city",
    }[locationView];
    const deviceColumn = deviceView;
    const entryClause =
      pageView === "entry" ? " AND (referrer IS NULL OR referrer = '')" : "";
    const [summary, chart, pages, referrers, locations, devices] =
      await Promise.all([
        bind<SummaryRow>(
          this.db.prepare(
            `SELECT COUNT(DISTINCT visitor_id) AS visitors, COUNT(*) AS pageviews, COUNT(DISTINCT session_id) AS sessions FROM events WHERE ${where.sql}`,
          ),
          values,
        ),
        bind<ChartRow>(
          this.db.prepare(
            `SELECT strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch') AS date, COUNT(DISTINCT visitor_id) AS visitors, COUNT(*) AS pageviews FROM events WHERE ${chartWhere.sql} GROUP BY date ORDER BY date ASC`,
          ),
          chartValues,
        ),
        bind<DimensionRow>(
          this.db.prepare(
            `SELECT path AS dimension, COUNT(*) AS views FROM events WHERE ${where.sql}${entryClause} GROUP BY path ORDER BY views DESC, path ASC LIMIT 50`,
          ),
          values,
        ),
        bind<DimensionRow>(
          this.db.prepare(
            `SELECT COALESCE(referrer, '') AS dimension, COUNT(*) AS views FROM events WHERE ${where.sql} GROUP BY referrer ORDER BY views DESC, dimension ASC LIMIT 50`,
          ),
          values,
        ),
        bind<DimensionRow>(
          this.db.prepare(
            `SELECT ${locationColumn} AS dimension, COUNT(DISTINCT visitor_id) AS views FROM events WHERE ${where.sql} GROUP BY ${locationColumn} ORDER BY views DESC, dimension ASC LIMIT 50`,
          ),
          values,
        ),
        bind<DimensionRow>(
          this.db.prepare(
            `SELECT ${deviceColumn} AS dimension, COUNT(DISTINCT visitor_id) AS views FROM events WHERE ${where.sql} GROUP BY ${deviceColumn} ORDER BY views DESC, dimension ASC LIMIT 50`,
          ),
          values,
        ),
      ]);
    return {
      summary: summary.results[0] ?? { visitors: 0, pageviews: 0, sessions: 0 },
      chart: chart.results,
      pages: pages.results,
      referrers: referrers.results,
      locations: locations.results,
      devices: devices.results,
    };
  }
}
