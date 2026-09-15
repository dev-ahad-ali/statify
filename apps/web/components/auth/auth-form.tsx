"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { forgotPassword, login, resetPassword, signup } from "@/lib/auth";

type AuthMode = "login" | "signup" | "forgot" | "reset";

export function AuthForm({ mode, token }: { mode: AuthMode; token?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const copy = {
    login: { title: "Welcome back", description: "Sign in to view your Statify analytics.", submit: "Sign in" },
    signup: { title: "Create your account", description: "Start collecting privacy-first analytics.", submit: "Create account" },
    forgot: { title: "Reset your password", description: "We will email a reset link if the account exists.", submit: "Send reset link" },
    reset: { title: "Choose a new password", description: "Your new password must be at least 8 characters.", submit: "Reset password" },
  }[mode];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const result = mode === "login"
      ? await login({ email, password })
      : mode === "signup"
        ? await signup({ name, email, password })
        : mode === "forgot"
          ? await forgotPassword(email)
          : await resetPassword({ token: token ?? "", password });
    setBusy(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    if (mode === "login" || mode === "signup") {
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    toast.success(mode === "forgot" ? "Check your email for a reset link." : "Password reset. You can sign in now.");
    router.replace("/login");
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submit}>
          {mode === "signup" && <Input aria-label="Name" autoComplete="name" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} required />}
          {mode !== "reset" && <Input aria-label="Email" autoComplete="email" type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />}
          {mode !== "forgot" && <Input aria-label="Password" autoComplete={mode === "login" ? "current-password" : "new-password"} type="password" placeholder="Password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />}
          <Button disabled={busy} type="submit">{busy ? "Working..." : copy.submit}</Button>
        </form>
        <div className="mt-5 flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
          {mode === "login" && <><Link className="underline underline-offset-4 hover:text-foreground" href="/forgot">Forgot password?</Link><Link className="underline underline-offset-4 hover:text-foreground" href="/signup">Create an account</Link></>}
          {mode === "signup" && <Link className="ml-auto underline underline-offset-4 hover:text-foreground" href="/login">Already have an account?</Link>}
          {(mode === "forgot" || mode === "reset") && <Link className="ml-auto underline underline-offset-4 hover:text-foreground" href="/login">Back to sign in</Link>}
        </div>
      </CardContent>
    </Card>
  );
}
