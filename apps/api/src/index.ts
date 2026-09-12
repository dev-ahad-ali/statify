import type { Event, Project } from "@statify/shared";

export type ApiContracts = {
  event: Event;
  project: Project;
};

export default {
  fetch(request: Request): Response {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok" });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
};
