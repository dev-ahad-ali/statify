"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth";

export function LogoutButton() {
  const router = useRouter();
  return <Button variant="outline" onClick={async () => {
    const result = await logout();
    if (result.error) toast.error(result.error);
    else router.replace("/login");
  }}>Sign out</Button>;
}
