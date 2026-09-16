import { Suspense } from "react";
import { SettingsClient } from "@/components/settings/settings-client";

export default function SettingsPage() {
  return <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8"><div className="mx-auto max-w-4xl"><Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}><SettingsClient /></Suspense></div></main>;
}
