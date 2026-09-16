export type ProjectRow = {
  id: string;
  owner_id: string;
  name: string;
  domain: string;
  api_key: string;
  allowed_domains: string;
  is_active: number;
  created_at: number;
  updated_at: number;
};

export class ProjectsRepository {
  constructor(private readonly db: D1Database) {}

  listByOwner(ownerId: string) {
    return this.db
      .prepare("SELECT * FROM projects WHERE owner_id = ? AND is_active = 1 ORDER BY created_at ASC")
      .bind(ownerId)
      .all<ProjectRow>();
  }

  listActive() {
    return this.db.prepare("SELECT * FROM projects WHERE is_active = 1 ORDER BY created_at ASC").all<ProjectRow>();
  }

  findByIdOwned(id: string, ownerId: string) {
    return this.db
      .prepare("SELECT * FROM projects WHERE id = ? AND owner_id = ? AND is_active = 1")
      .bind(id, ownerId)
      .first<ProjectRow>();
  }

  create(project: ProjectRow) {
    return this.db
      .prepare(
        "INSERT INTO projects (id, owner_id, name, domain, api_key, allowed_domains, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        project.id,
        project.owner_id,
        project.name,
        project.domain,
        project.api_key,
        project.allowed_domains,
        project.is_active,
        project.created_at,
        project.updated_at,
      )
      .run();
  }

  updateName(id: string, ownerId: string, name: string, updatedAt: number) {
    return this.db
      .prepare("UPDATE projects SET name = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND is_active = 1")
      .bind(name, updatedAt, id, ownerId)
      .run();
  }

  updateAllowedDomains(id: string, ownerId: string, allowedDomains: string, updatedAt: number) {
    return this.db
      .prepare("UPDATE projects SET allowed_domains = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND is_active = 1")
      .bind(allowedDomains, updatedAt, id, ownerId)
      .run();
  }

  rotateApiKey(id: string, ownerId: string, apiKey: string, updatedAt: number) {
    return this.db
      .prepare("UPDATE projects SET api_key = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND is_active = 1")
      .bind(apiKey, updatedAt, id, ownerId)
      .run();
  }

  softDelete(id: string, ownerId: string, updatedAt: number) {
    return this.db
      .prepare("UPDATE projects SET is_active = 0, updated_at = ? WHERE id = ? AND owner_id = ? AND is_active = 1")
      .bind(updatedAt, id, ownerId)
      .run();
  }
}
