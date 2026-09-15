"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUser, type User } from "@/lib/auth";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getCurrentUser().then((result) => {
      if (result.data) setUser(result.data);
      else router.replace("/login");
      setReady(true);
    });
  }, [router]);

  if (!ready || !user) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Checking your session...</div>;
  return <>{children}</>;
}

export function GuestGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getCurrentUser().then((result) => {
      if (result.data) router.replace("/dashboard");
      else setReady(true);
    });
  }, [pathname, router]);

  if (!ready) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Checking your session...</div>;
  return <>{children}</>;
}
