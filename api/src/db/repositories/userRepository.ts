import db, { generateId, VALID_ROLES, UserRole } from "../database";
import bcrypt from "bcrypt";
import crypto from "crypto";

export interface User {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  status: "active" | "disabled" | "pending";
  force_password_change: boolean;
  hashed_password?: string;
  created_by?: string;
  last_login_at?: string;
  created_at?: string;
  updated_at?: string;
}

// Parse user from DB row
const parseUser = (row: any): User | null => {
  if (!row) return null;
  return {
    ...row,
    role: row.role || 'loco_pilot',
    force_password_change: Boolean(row.force_password_change),
  };
};

// Generate secure random password
export const generateSecurePassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
  const bytes = crypto.randomBytes(16);
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
};

export const userRepository = {
  findByEmail: (email: string): User | null => {
    const stmt = db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE");
    return parseUser(stmt.get(email));
  },

  findById: (id: string): User | null => {
    const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
    return parseUser(stmt.get(id));
  },

  create: (user: Partial<User> & { email: string }): User => {
    const id = generateId();
    
    // Validate role
    const role = user.role || 'loco_pilot';
    if (!VALID_ROLES.includes(role as UserRole)) {
      throw new Error(`Invalid role: ${role}`);
    }

    const stmt = db.prepare(`
      INSERT INTO users (id, email, name, firstName, lastName, role, roles, status, force_password_change, hashed_password, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      user.email.toLowerCase(),
      user.name || null,
      user.firstName || null,
      user.lastName || null,
      role,
      JSON.stringify([role]), // Keep roles in sync for backward compat
      user.status || "pending",
      user.force_password_change !== false ? 1 : 0,
      user.hashed_password || null,
      user.created_by || null
    );

    return userRepository.findById(id)!;
  },

  update: (id: string, data: Partial<User>): User | null => {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push("name = ?");
      values.push(data.name);
    }
    if (data.firstName !== undefined) {
      updates.push("firstName = ?");
      values.push(data.firstName);
    }
    if (data.lastName !== undefined) {
      updates.push("lastName = ?");
      values.push(data.lastName);
    }
    if (data.role !== undefined) {
      if (!VALID_ROLES.includes(data.role as UserRole)) {
        throw new Error(`Invalid role: ${data.role}`);
      }
      updates.push("role = ?");
      values.push(data.role);
      updates.push("roles = ?");
      values.push(JSON.stringify([data.role])); // Keep in sync
    }
    if (data.status !== undefined) {
      updates.push("status = ?");
      values.push(data.status);
    }
    if (data.force_password_change !== undefined) {
      updates.push("force_password_change = ?");
      values.push(data.force_password_change ? 1 : 0);
    }
    if (data.hashed_password !== undefined) {
      updates.push("hashed_password = ?");
      values.push(data.hashed_password);
    }
    if (data.last_login_at !== undefined) {
      updates.push("last_login_at = ?");
      values.push(data.last_login_at);
    }

    if (updates.length === 0) return userRepository.findById(id);

    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    const stmt = db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`);
    stmt.run(...values);

    return userRepository.findById(id);
  },

  list: (filters: { search?: string; role?: string; status?: string }, pagination: { page: number; limit: number }) => {
    let query = "SELECT * FROM users WHERE 1=1";
    const params: any[] = [];

    if (filters.search) {
      query += " AND (email LIKE ? OR name LIKE ? OR firstName LIKE ? OR lastName LIKE ?)";
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.role) {
      query += " AND role = ?";
      params.push(filters.role);
    }

    if (filters.status) {
      query += " AND status = ?";
      params.push(filters.status);
    }

    // Get total count
    const countStmt = db.prepare(query.replace("SELECT *", "SELECT COUNT(*) as count"));
    const { count: total } = countStmt.get(...params) as { count: number };

    // Get paginated results
    const offset = (pagination.page - 1) * pagination.limit;
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(pagination.limit, offset);

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    const users = rows.map(parseUser).filter((u): u is User => u !== null);

    return {
      users,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  },

  comparePassword: async (user: User, plainPassword: string): Promise<boolean> => {
    if (!user.hashed_password) return false;
    return bcrypt.compare(plainPassword, user.hashed_password);
  },

  hashPassword: async (password: string): Promise<string> => {
    return bcrypt.hash(password, 10);
  },
};

export default userRepository;
