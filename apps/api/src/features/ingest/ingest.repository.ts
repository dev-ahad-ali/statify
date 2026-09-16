import type { ProjectRow } from "../projects/projects.repository.js";

export type IngestProject = {
  projectId: string;
  domain: string;
  allowedDomains: string[];
};

export class IngestRepository {
  constructor(private readonly db: D1Database) {}

  async findProjectByApiKey(apiKey: string): Promise<IngestProject | null> {
    const project = await this.db.prepare("SELECT * FROM projects WHERE api_key = ? AND is_active = 1").bind(apiKey).first<ProjectRow>();
    if (!project) return null;
    return {
      projectId: project.id,
      domain: project.domain,
      allowedDomains: JSON.parse(project.allowed_domains) as string[],
    };
  }
}
