import db, { generateId } from "../database";

export interface AuditLog {
  id: string;
  actor_id?: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  ip: string;
  timestamp: string;
}

const parseLog = (row: any): AuditLog | null => {
  if (!row) return null;
  return {
    ...row,
    details: JSON.parse(row.details || "{}"),
  };
};

export const auditLogRepository = {
  create: (log: Omit<AuditLog, "id" | "timestamp">): AuditLog => {
    const id = generateId();
    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, resource, details, ip)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      log.actor_id || null,
      log.action,
      log.resource,
      JSON.stringify(log.details || {}),
      log.ip
    );

    return auditLogRepository.findById(id)!;
  },

  findById: (id: string): AuditLog | null => {
    const stmt = db.prepare("SELECT * FROM audit_logs WHERE id = ?");
    return parseLog(stmt.get(id));
  },

  findByResource: (resource: string, pagination: { page: number; limit: number }) => {
    const countStmt = db.prepare("SELECT COUNT(*) as count FROM audit_logs WHERE resource = ?");
    const { count: total } = countStmt.get(resource) as { count: number };

    const offset = (pagination.page - 1) * pagination.limit;
    const stmt = db.prepare(`
      SELECT * FROM audit_logs WHERE resource = ? 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `);
    
    const rows = stmt.all(resource, pagination.limit, offset);
    const logs = rows.map(parseLog).filter((l): l is AuditLog => l !== null);

    return {
      logs,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  },

  findByActor: (actorId: string, pagination: { page: number; limit: number }) => {
    const countStmt = db.prepare("SELECT COUNT(*) as count FROM audit_logs WHERE actor_id = ?");
    const { count: total } = countStmt.get(actorId) as { count: number };

    const offset = (pagination.page - 1) * pagination.limit;
    const stmt = db.prepare(`
      SELECT * FROM audit_logs WHERE actor_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `);
    
    const rows = stmt.all(actorId, pagination.limit, offset);
    const logs = rows.map(parseLog).filter((l): l is AuditLog => l !== null);

    return {
      logs,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  },

  findByAction: (actions: string[], limit?: number): AuditLog[] => {
    const placeholders = actions.map(() => "?").join(",");
    const query = limit
      ? `SELECT * FROM audit_logs WHERE action IN (${placeholders}) ORDER BY timestamp DESC LIMIT ?`
      : `SELECT * FROM audit_logs WHERE action IN (${placeholders}) ORDER BY timestamp DESC`;
    
    const stmt = db.prepare(query);
    const rows = limit ? stmt.all(...actions, limit) : stmt.all(...actions);
    return rows.map(parseLog).filter((l): l is AuditLog => l !== null);
  },
};

export default auditLogRepository;
