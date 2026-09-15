import type { ReactNode } from "react";
import { GuestGuard } from "@/components/auth/auth-guard";
import { AuthShell } from "@/components/auth/auth-shell";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <GuestGuard><AuthShell>{children}</AuthShell></GuestGuard>;
}
