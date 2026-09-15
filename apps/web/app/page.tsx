import type { Project } from "@statify/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const exampleProject: Pick<Project, "name" | "domain"> = {
  name: "Statify",
  domain: "example.com",
};

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{exampleProject.name}</CardTitle>
          <CardDescription>Privacy-first analytics for {exampleProject.domain}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">The Statify web app is ready for the dashboard work.</p>
          <Button>Get started</Button>
        </CardContent>
      </Card>
    </main>
  );
}
