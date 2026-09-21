"use client";

import { countries } from "countries-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type BreakdownRow = { dimension: string; views: number };

type ViewOption = { value: string; label: string };

export function BreakdownCard({
  title,
  description,
  rows,
  views,
  activeView,
  onViewChange,
  filterKey,
  onRowClick,
  kind,
}: {
  title: string;
  description?: string;
  rows: BreakdownRow[];
  views?: ViewOption[];
  activeView?: string;
  onViewChange?: (value: string) => void;
  filterKey: string;
  onRowClick: (key: string, value: string) => void;
  kind: "page" | "referrer" | "location" | "device";
}) {
  const total = rows.reduce((sum, row) => sum + row.views, 0);
  return (
    <Card className="min-w-0">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {views && activeView && onViewChange && (
          <div className="flex rounded-md bg-muted p-1">
            {views.map((view) => (
              <button
                key={view.value}
                type="button"
                className={`rounded px-2 py-1 text-xs ${view.value === activeView ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
                onClick={() => onViewChange(view.value)}
              >
                {view.label}
              </button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No data for this range.
          </p>
        ) : (
          <div className="relative">
            <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {rows.map((row) => (
                <BreakdownRow
                  key={`${row.dimension}-${row.views}`}
                  row={row}
                  total={total}
                  kind={kind}
                  onClick={() => onRowClick(filterKey, row.dimension)}
                />
              ))}
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BreakdownRow({
  row,
  total,
  kind,
  onClick,
}: {
  row: BreakdownRow;
  total: number;
  kind: BreakdownCardProps["kind"];
  onClick: () => void;
}) {
  const percentage = total > 0 ? Math.round((row.views / total) * 100) : 0;
  const countryCode =
    row.dimension.length === 2 && /^[a-z]{2}$/i.test(row.dimension)
      ? row.dimension.toUpperCase()
      : null;
  const countryName =
    countryCode && countryCode in countries
      ? countries[countryCode as keyof typeof countries].name
      : null;
  const label =
    kind === "referrer" && (row.dimension === "unknown" || !row.dimension)
      ? "(Direct)"
      : (countryName ?? row.dimension) || "Unknown";
  return (
    <button
      type="button"
      className="group relative flex w-full items-center gap-3 overflow-hidden rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
      onClick={onClick}
    >
      {kind === "location" && countryCode && (
        <img
          src={`https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`}
          alt=""
          className="h-4 w-6 rounded-sm object-cover"
          loading="lazy"
        />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {kind === "device" && (
        <span
          className="absolute inset-y-0 left-0 -z-0 bg-primary/5"
          style={{ width: `${percentage}%` }}
        />
      )}
      <span className="relative tabular-nums text-muted-foreground">
        {row.views.toLocaleString()}
      </span>
    </button>
  );
}

type BreakdownCardProps = { kind: "page" | "referrer" | "location" | "device" };
