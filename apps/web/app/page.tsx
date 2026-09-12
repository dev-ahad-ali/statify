import type { Project } from "@statify/shared";

const exampleProject: Pick<Project, "name" | "domain"> = {
  name: "Statify",
  domain: "example.com",
};

export default function Home() {
  return (
    <main>
      <h1>{exampleProject.name}</h1>
      <p>Analytics for {exampleProject.domain}</p>
    </main>
  );
}
