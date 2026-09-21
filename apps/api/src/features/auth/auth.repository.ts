export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: number;
  updated_at: number;
};

export type RefreshTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: number;
  created_at: number;
};

export type ResetTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: number;
  used_at: number | null;
};

export class AuthRepository {
  constructor(private readonly db: D1Database) {}

  findUserByEmail(email: string) {
    return this.db
      .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
      .bind(email)
      .first<UserRow>();
  }

  findUserById(id: string) {
    return this.db
      .prepare("SELECT * FROM users WHERE id = ?")
      .bind(id)
      .first<UserRow>();
  }

  insertUser(user: UserRow) {
    return this.db
      .prepare(
        "INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        user.id,
        user.email,
        user.password_hash,
        user.name,
        user.created_at,
        user.updated_at,
      )
      .run();
  }

  insertRefreshToken(
    id: string,
    userId: string,
    tokenHash: string,
    expiresAt: number,
    createdAt: number,
  ) {
    return this.db
      .prepare(
        "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(id, userId, tokenHash, expiresAt, createdAt)
      .run();
  }

  findRefreshToken(tokenHash: string) {
    return this.db
      .prepare("SELECT * FROM refresh_tokens WHERE token_hash = ?")
      .bind(tokenHash)
      .first<RefreshTokenRow>();
  }

  deleteRefreshToken(tokenHash: string) {
    return this.db
      .prepare("DELETE FROM refresh_tokens WHERE token_hash = ?")
      .bind(tokenHash)
      .run();
  }

  deleteRefreshTokensForUser(userId: string) {
    return this.db
      .prepare("DELETE FROM refresh_tokens WHERE user_id = ?")
      .bind(userId)
      .run();
  }

  rotateRefreshToken(
    oldHash: string,
    id: string,
    userId: string,
    tokenHash: string,
    expiresAt: number,
    createdAt: number,
  ) {
    return this.db.batch([
      this.db
        .prepare("DELETE FROM refresh_tokens WHERE token_hash = ?")
        .bind(oldHash),
      this.db
        .prepare(
          "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(id, userId, tokenHash, expiresAt, createdAt),
    ]);
  }

  insertResetToken(
    id: string,
    userId: string,
    tokenHash: string,
    expiresAt: number,
  ) {
    return this.db
      .prepare(
        "INSERT INTO reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
      )
      .bind(id, userId, tokenHash, expiresAt)
      .run();
  }

  findResetToken(tokenHash: string) {
    return this.db
      .prepare("SELECT * FROM reset_tokens WHERE token_hash = ?")
      .bind(tokenHash)
      .first<ResetTokenRow>();
  }

  consumeResetToken(
    tokenHash: string,
    userId: string,
    usedAt: number,
    passwordHash: string,
    updatedAt: number,
  ) {
    return this.db.batch([
      this.db
        .prepare(
          "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
        )
        .bind(passwordHash, updatedAt, userId),
      this.db
        .prepare(
          "UPDATE reset_tokens SET used_at = ? WHERE token_hash = ? AND user_id = ?",
        )
        .bind(usedAt, tokenHash, userId),
      this.db
        .prepare("DELETE FROM refresh_tokens WHERE user_id = ?")
        .bind(userId),
    ]);
  }
}
