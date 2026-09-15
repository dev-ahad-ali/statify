import { LogoutButton } from "@/components/auth/logout-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 py-8">
        <div><p className="text-sm text-muted-foreground">Statify</p><h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1></div>
        <LogoutButton />
      </div>
      <Card className="mx-auto max-w-5xl">
        <CardHeader><CardTitle>Your analytics are ready</CardTitle><CardDescription>The dashboard data views are coming in the next tickets.</CardDescription></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Create a project and add the Statify script to start collecting events.</p></CardContent>
      </Card>
    </main>
  );
}
