import db, { generateId } from "../database";
import bcrypt from "bcrypt";

export interface RefreshToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  revoked: boolean;
  revoked_at?: string;
  created_at?: string;
}

const parseToken = (row: any): RefreshToken | null => {
  if (!row) return null;
  return {
    ...row,
    revoked: Boolean(row.revoked),
  };
};

export const refreshTokenRepository = {
  create: async (userId: string, plainToken: string, expiresAt: Date): Promise<RefreshToken> => {
    const id = generateId();
    const hashedToken = await bcrypt.hash(plainToken, 10);
    
    const stmt = db.prepare(`
      INSERT INTO refresh_tokens (id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(id, userId, hashedToken, expiresAt.toISOString());
    
    return refreshTokenRepository.findById(id)!;
  },

  findById: (id: string): RefreshToken | null => {
    const stmt = db.prepare("SELECT * FROM refresh_tokens WHERE id = ?");
    return parseToken(stmt.get(id));
  },

  findValidTokensForUser: (userId: string): RefreshToken[] => {
    const stmt = db.prepare(`
      SELECT * FROM refresh_tokens 
      WHERE user_id = ? 
        AND revoked = 0 
        AND expires_at > datetime('now')
    `);
    return stmt.all(userId).map(parseToken).filter((t): t is RefreshToken => t !== null);
  },

  compareToken: async (storedHash: string, plainToken: string): Promise<boolean> => {
    return bcrypt.compare(plainToken, storedHash);
  },

  findValidTokenByPlain: async (plainToken: string): Promise<{ token: RefreshToken; userId: string } | null> => {
    // Get all non-revoked, non-expired tokens
    const stmt = db.prepare(`
      SELECT * FROM refresh_tokens 
      WHERE revoked = 0 
        AND expires_at > datetime('now')
    `);
    const tokens = stmt.all() as any[];

    // Compare each token (bcrypt hashing means we can't do direct lookup)
    for (const row of tokens) {
      const isMatch = await bcrypt.compare(plainToken, row.token);
      if (isMatch) {
        return { token: parseToken(row)!, userId: row.user_id };
      }
    }

    return null;
  },

  revoke: (id: string): void => {
    const stmt = db.prepare(`
      UPDATE refresh_tokens 
      SET revoked = 1, revoked_at = datetime('now') 
      WHERE id = ?
    `);
    stmt.run(id);
  },

  revokeAllForUser: (userId: string): void => {
    const stmt = db.prepare(`
      UPDATE refresh_tokens 
      SET revoked = 1, revoked_at = datetime('now') 
      WHERE user_id = ? AND revoked = 0
    `);
    stmt.run(userId);
  },
};

export default refreshTokenRepository;
