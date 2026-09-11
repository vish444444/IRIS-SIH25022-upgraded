import db, { generateId } from "../database";

export interface AIConflictRecord {
  id: string;
  conflict_type: string;
  severity: string;
  trains: string; // JSON array
  location: string;
  predicted_time_sec?: number;
  probability?: number;
  reason?: string;
  resolved: number;
  created_at?: string;
}

export interface AIRecommendationRecord {
  id: string;
  conflict_id?: string;
  resource_id?: string;
  label: string;
  is_safe: number;
  total_weighted_delay_sec?: number;
  objective_value?: number;
  confidence?: number;
  raw_json?: string;
  status: string;
  decided_by?: string;
  decided_at?: string;
  created_at?: string;
}

class AIRepository {
  createConflict(data: Omit<AIConflictRecord, "id" | "created_at">): AIConflictRecord {
    const id = generateId();
    db.prepare(
      `INSERT INTO ai_conflicts (id, conflict_type, severity, trains, location, predicted_time_sec, probability, reason, resolved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, data.conflict_type, data.severity, data.trains, data.location,
      data.predicted_time_sec ?? null, data.probability ?? null, data.reason ?? null,
      data.resolved ?? 0
    );
    return this.findConflictById(id)!;
  }

  findConflictById(id: string): AIConflictRecord | undefined {
    return db.prepare(`SELECT * FROM ai_conflicts WHERE id = ?`).get(id) as AIConflictRecord | undefined;
  }

  listConflicts(limit = 50): AIConflictRecord[] {
    return db.prepare(`SELECT * FROM ai_conflicts ORDER BY created_at DESC LIMIT ?`).all(limit) as AIConflictRecord[];
  }

  createRecommendation(data: Omit<AIRecommendationRecord, "id" | "created_at">): AIRecommendationRecord {
    const id = generateId();
    db.prepare(
      `INSERT INTO ai_recommendations (id, conflict_id, resource_id, label, is_safe, total_weighted_delay_sec, objective_value, confidence, raw_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, data.conflict_id ?? null, data.resource_id ?? null, data.label, data.is_safe,
      data.total_weighted_delay_sec ?? null, data.objective_value ?? null, data.confidence ?? null,
      data.raw_json ?? null, data.status ?? "pending"
    );
    return this.findRecommendationById(id)!;
  }

  findRecommendationById(id: string): AIRecommendationRecord | undefined {
    return db.prepare(`SELECT * FROM ai_recommendations WHERE id = ?`).get(id) as AIRecommendationRecord | undefined;
  }

  listRecommendations(limit = 50): AIRecommendationRecord[] {
    return db.prepare(`SELECT * FROM ai_recommendations ORDER BY created_at DESC LIMIT ?`).all(limit) as AIRecommendationRecord[];
  }

  decideRecommendation(id: string, status: "approved" | "rejected" | "overridden", decidedBy: string) {
    db.prepare(
      `UPDATE ai_recommendations SET status = ?, decided_by = ?, decided_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(status, decidedBy, id);
    return this.findRecommendationById(id);
  }

  logOptimizationRun(data: { n_trains: number; feasible: boolean; runtime_sec: number; n_options: number; raw_json: string }) {
    const id = generateId();
    db.prepare(
      `INSERT INTO ai_optimization_runs (id, n_trains, feasible, runtime_sec, n_options, raw_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, data.n_trains, data.feasible ? 1 : 0, data.runtime_sec, data.n_options, data.raw_json);
    return id;
  }

  listOptimizationRuns(limit = 50) {
    return db.prepare(`SELECT * FROM ai_optimization_runs ORDER BY created_at DESC LIMIT ?`).all(limit);
  }

  createDisruption(data: { disruption_type: string; resource_id?: string; description?: string; created_by?: string }) {
    const id = generateId();
    db.prepare(
      `INSERT INTO ai_disruptions (id, disruption_type, resource_id, description, created_by) VALUES (?, ?, ?, ?, ?)`
    ).run(id, data.disruption_type, data.resource_id ?? null, data.description ?? null, data.created_by ?? null);
    return db.prepare(`SELECT * FROM ai_disruptions WHERE id = ?`).get(id);
  }

  listActiveDisruptions() {
    return db.prepare(`SELECT * FROM ai_disruptions WHERE active = 1 ORDER BY created_at DESC`).all();
  }

  resolveDisruption(id: string) {
    db.prepare(`UPDATE ai_disruptions SET active = 0, resolved_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
  }

  saveScenario(data: { name: string; description?: string; input_json: string; baseline_result_json: string; optimized_result_json: string; created_by?: string }) {
    const id = generateId();
    db.prepare(
      `INSERT INTO ai_scenarios (id, name, description, input_json, baseline_result_json, optimized_result_json, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.name, data.description ?? null, data.input_json, data.baseline_result_json, data.optimized_result_json, data.created_by ?? null);
    return db.prepare(`SELECT * FROM ai_scenarios WHERE id = ?`).get(id);
  }

  listScenarios(limit = 50) {
    return db.prepare(`SELECT * FROM ai_scenarios ORDER BY created_at DESC LIMIT ?`).all(limit);
  }
}

export default new AIRepository();
