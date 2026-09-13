export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: number;
  updated_at: number;
};

export class AuthRepository {
  constructor(private readonly db: D1Database) {}

  findUserByEmail(email: string) {
    return this.db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").bind(email).first<UserRow>();
  }

  insertUser(user: UserRow) {
    return this.db
      .prepare("INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(user.id, user.email, user.password_hash, user.name, user.created_at, user.updated_at)
      .run();
  }

  insertRefreshToken(id: string, userId: string, tokenHash: string, expiresAt: number, createdAt: number) {
    return this.db
      .prepare("INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(id, userId, tokenHash, expiresAt, createdAt)
      .run();
  }
}
