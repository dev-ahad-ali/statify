import { Suspense } from "react";
import { AuditsClient } from "@/components/audits/audits-client";

export default function AuditsPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Suspense
          fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}
        >
          <AuditsClient />
        </Suspense>
      </div>
    </main>
  );
}
