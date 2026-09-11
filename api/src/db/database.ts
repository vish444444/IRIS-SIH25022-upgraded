import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// Database file path
const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = process.env.SQLITE_PATH || path.join(DATA_DIR, "iris.db");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Create database connection
const db = Database(DB_PATH);

// Enable foreign keys
db.pragma("foreign_keys = ON");

// Valid roles enum
export const VALID_ROLES = ['system_admin', 'section_controller', 'signal_operator', 'loco_pilot'] as const;
export type UserRole = typeof VALID_ROLES[number];

// Role priority for migration (highest first)
const ROLE_PRIORITY: UserRole[] = ['system_admin', 'section_controller', 'signal_operator', 'loco_pilot'];

// Initialize schema
const initSchema = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      firstName TEXT,
      lastName TEXT,
      role TEXT DEFAULT 'loco_pilot',
      roles TEXT DEFAULT '["loco_pilot"]',
      status TEXT DEFAULT 'pending',
      force_password_change INTEGER DEFAULT 1,
      hashed_password TEXT,
      created_by TEXT,
      last_login_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      permissions TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked INTEGER DEFAULT 0,
      revoked_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      details TEXT DEFAULT '{}',
      ip TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (actor_id) REFERENCES users(id)
    );

    -- === AI Decision-Support entities (added for SIH25022 upgrade) ===
    -- These tables persist a durable audit trail of AI activity on the
    -- Node.js side, mirroring (but not replacing) the AI service's own
    -- in-memory run history. See ai-service/api/main.py for the source
    -- of truth for live computation; these tables are the durable log.

    CREATE TABLE IF NOT EXISTS ai_conflicts (
      id TEXT PRIMARY KEY,
      conflict_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      trains TEXT NOT NULL,
      location TEXT NOT NULL,
      predicted_time_sec REAL,
      probability REAL,
      reason TEXT,
      resolved INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_recommendations (
      id TEXT PRIMARY KEY,
      conflict_id TEXT,
      resource_id TEXT,
      label TEXT NOT NULL,
      is_safe INTEGER NOT NULL,
      total_weighted_delay_sec REAL,
      objective_value REAL,
      confidence REAL,
      raw_json TEXT,
      status TEXT DEFAULT 'pending', -- pending | approved | rejected | overridden
      decided_by TEXT,
      decided_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conflict_id) REFERENCES ai_conflicts(id)
    );

    CREATE TABLE IF NOT EXISTS ai_optimization_runs (
      id TEXT PRIMARY KEY,
      n_trains INTEGER,
      feasible INTEGER,
      runtime_sec REAL,
      n_options INTEGER,
      raw_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_scenarios (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      input_json TEXT,
      baseline_result_json TEXT,
      optimized_result_json TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_disruptions (
      id TEXT PRIMARY KEY,
      disruption_type TEXT NOT NULL, -- breakdown | track_blockage | signal_restriction | weather | platform_unavailable
      resource_id TEXT,
      description TEXT,
      active INTEGER DEFAULT 1,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_ai_recommendations_status ON ai_recommendations(status);
    CREATE INDEX IF NOT EXISTS idx_ai_conflicts_resolved ON ai_conflicts(resolved);
    CREATE INDEX IF NOT EXISTS idx_ai_disruptions_active ON ai_disruptions(active);

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
  `);

  console.log("Database schema initialized");
};

// Seed default roles
const seedDefaultRoles = () => {
  const roles = [
    {
      id: "system_admin",
      name: "System Administrator",
      permissions: ["user:read", "user:create", "user:update", "user:delete", "audit:read", "role:manage"],
    },
    {
      id: "section_controller",
      name: "Section Controller",
      permissions: ["dashboard:read", "decision:accept", "decision:override", "log:write"],
    },
    {
      id: "signal_operator",
      name: "Signal Operator",
      permissions: ["signals:read", "alerts:ack", "log:write"],
    },
    {
      id: "loco_pilot",
      name: "Loco Pilot",
      permissions: ["instructions:read", "log:write"],
    },
  ];

  const insertRole = db.prepare(`
    INSERT OR REPLACE INTO roles (id, name, permissions) VALUES (?, ?, ?)
  `);

  for (const role of roles) {
    insertRole.run(role.id, role.name, JSON.stringify(role.permissions));
  }

  console.log("Default roles seeded");
};

// Migrate existing users from roles[] to single role
const migrateToSingleRole = () => {
  try {
    // Check if we need to migrate
    const usersWithoutRole = db.prepare("SELECT id, roles FROM users WHERE role IS NULL OR role = ''").all() as any[];
    
    if (usersWithoutRole.length === 0) {
      return; // No migration needed
    }

    console.log(`Migrating ${usersWithoutRole.length} users to single role...`);

    const updateStmt = db.prepare("UPDATE users SET role = ? WHERE id = ?");

    for (const user of usersWithoutRole) {
      let roles: string[] = [];
      try {
        roles = JSON.parse(user.roles || '["loco_pilot"]');
      } catch {
        roles = ['loco_pilot'];
      }

      // Pick highest priority role
      let selectedRole: string = 'loco_pilot';
      for (const priorityRole of ROLE_PRIORITY) {
        if (roles.includes(priorityRole)) {
          selectedRole = priorityRole;
          break;
        }
      }

      updateStmt.run(selectedRole, user.id);
    }

    console.log("Migration to single role complete");
  } catch (err) {
    console.error("Migration error (non-fatal):", err);
  }
};

// Initialize database
export const initializeDatabase = () => {
  try {
    initSchema();
    seedDefaultRoles();
    migrateToSingleRole();
    console.log("Database ready");
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
};

// Generate UUID
export const generateId = (): string => crypto.randomUUID();

// Export database instance for repositories
export default db;
