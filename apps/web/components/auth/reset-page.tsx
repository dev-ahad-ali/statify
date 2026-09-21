"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  return <AuthForm mode="reset" token={token} />;
}

export function ResetPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-muted-foreground">
          Loading reset link...
        </div>
      }
    >
      <ResetForm />
    </Suspense>
  );
}
