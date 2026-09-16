import { Suspense } from "react";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { DemoProvider } from "@/components/dashboard/demo-context";

export default function DemoPage() {
  return <DemoProvider><main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl"><Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}><DashboardClient /></Suspense></div></main></DemoProvider>;
}
