import { Suspense } from "react";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl"><Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}><DashboardClient /></Suspense></div>
    </main>
  );
}
