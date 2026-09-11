import { Request, Response, NextFunction } from "express";
import AIServiceClient from "../services/ai/aiServiceClient";
import aiRepository from "../db/repositories/aiRepository";
import { auditLogRepository } from "../db/repositories/auditLogRepository";
import { AuthenticatedRequest } from "../middleware/rbac.middleware";

const getClientIP = (req: Request): string =>
  (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
  (req.headers["x-real-ip"] as string) ||
  req.socket.remoteAddress ||
  "unknown";

/**
 * Node.js proxy layer for the Python AI Decision-Support Service.
 * This layer:
 *   1. Forwards requests to the AI service (ai-service/, FastAPI)
 *   2. Persists a durable audit trail in SQLite (ai_recommendations,
 *      ai_optimization_runs, ai_conflicts, ai_disruptions)
 *   3. Writes generic audit_log entries so AI activity shows up
 *      alongside existing sector-blockage / auth audit events.
 *
 * IMPORTANT: This controller NEVER issues train movement commands. It
 * only proxies decision-support computations and persists what
 * happened. Approval/rejection/override still requires an explicit
 * controller action via /api/ai/recommendations/:id/decide.
 */
export class AIController {
  private client = AIServiceClient.getInstance();

  status = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.client.status();
      res.status(200).json({ success: true, ...data });
    } catch (error: any) {
      res.status(503).json({
        success: false,
        error: "AI service unavailable",
        detail: error?.message,
        hint: "Ensure ai-service is running: cd ai-service && uvicorn api.main:app --port 8001",
      });
    }
  };

  predictDelay = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.client.predictDelay(req.body);
      res.status(200).json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  };

  detectConflicts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.client.detectConflicts(req.body);
      for (const c of data.conflicts || []) {
        aiRepository.createConflict({
          conflict_type: c.conflict_type,
          severity: c.severity,
          trains: JSON.stringify(c.trains),
          location: c.location,
          predicted_time_sec: c.predicted_time_sec,
          probability: c.probability,
          reason: c.reason,
          resolved: 0,
        });
      }
      res.status(200).json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  };

  optimize = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.client.optimize(req.body);
      aiRepository.logOptimizationRun({
        n_trains: (req.body.requests || []).length,
        feasible: data.feasible,
        runtime_sec: data.runtime_sec,
        n_options: (data.options || []).length,
        raw_json: JSON.stringify(data),
      });
      res.status(200).json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  };

  validate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.client.validate(req.body);
      res.status(200).json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  };

  recommend = async (req: Request | AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.client.recommend(req.body);
      const top = (data.recommendations || [])[0];
      let savedId: string | undefined;
      if (top) {
        const saved = aiRepository.createRecommendation({
          resource_id: req.body?.conflict_trains?.[0]?.resource_id,
          label: top.label,
          is_safe: top.safety_status === "PASS" ? 1 : 0,
          total_weighted_delay_sec: top.expected_impact?.total_weighted_delay_sec,
          objective_value: undefined,
          confidence: top.recommendation_score,
          raw_json: JSON.stringify(data),
          status: "pending",
        });
        savedId = saved.id;
      }
      res.status(200).json({ success: true, saved_recommendation_id: savedId, ...data });
    } catch (error) {
      next(error);
    }
  };

  /** POST /api/ai/recommendations/:id/decide  { decision: "approved"|"rejected", user } */
  decideRecommendation = async (req: Request | AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { decision } = req.body;
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.id || "unknown";

      if (!["approved", "rejected"].includes(decision)) {
        res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
        return;
      }

      const updated = aiRepository.decideRecommendation(id, decision, userId);
      auditLogRepository.create({
        actor_id: authReq.user?.id,
        action: `ai.recommendation.${decision}`,
        resource: `recommendation:${id}`,
        details: { recommendation_id: id, decision },
        ip: getClientIP(req),
      });

      res.status(200).json({ success: true, recommendation: updated });
    } catch (error) {
      next(error);
    }
  };

  override = async (req: Request | AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const data = await this.client.override({
        ...req.body,
        user_id: authReq.user?.id,
      });

      auditLogRepository.create({
        actor_id: authReq.user?.id,
        action: data.override_allowed ? "ai.override.allowed" : "ai.override.blocked",
        resource: `override:${req.body.original_recommendation_id || "manual"}`,
        details: { reasons: data.reasons, plans: req.body.plans },
        ip: getClientIP(req),
      });

      if (req.body.original_recommendation_id && data.override_allowed) {
        aiRepository.decideRecommendation(req.body.original_recommendation_id, "overridden", authReq.user?.id || "unknown");
      }

      res.status(data.override_allowed ? 200 : 409).json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  };

  whatIf = async (req: Request | AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.client.whatIf(req.body);
      const authReq = req as AuthenticatedRequest;
      aiRepository.saveScenario({
        name: req.body.scenario_name || "custom",
        input_json: JSON.stringify(req.body),
        baseline_result_json: JSON.stringify(data.baseline),
        optimized_result_json: JSON.stringify(data.ai_optimized),
        created_by: authReq.user?.id,
      });
      res.status(200).json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  };

  getRecommendations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const records = aiRepository.listRecommendations(parseInt((req.query.limit as string) || "50"));
      res.status(200).json({ success: true, count: records.length, recommendations: records });
    } catch (error) {
      next(error);
    }
  };

  getOptimizationRuns = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const records = aiRepository.listOptimizationRuns(parseInt((req.query.limit as string) || "50"));
      res.status(200).json({ success: true, count: records.length, runs: records });
    } catch (error) {
      next(error);
    }
  };

  getConflicts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const records = aiRepository.listConflicts(parseInt((req.query.limit as string) || "50"));
      res.status(200).json({ success: true, count: records.length, conflicts: records });
    } catch (error) {
      next(error);
    }
  };

  createDisruption = async (req: Request | AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { disruption_type, resource_id, description } = req.body;
      if (!disruption_type) {
        res.status(400).json({ error: "disruption_type is required" });
        return;
      }
      const record = aiRepository.createDisruption({
        disruption_type, resource_id, description, created_by: authReq.user?.id,
      });
      auditLogRepository.create({
        actor_id: authReq.user?.id,
        action: "ai.disruption.created",
        resource: `disruption:${disruption_type}`,
        details: { disruption_type, resource_id, description },
        ip: getClientIP(req),
      });
      res.status(201).json({ success: true, disruption: record });
    } catch (error) {
      next(error);
    }
  };

  listDisruptions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const records = aiRepository.listActiveDisruptions();
      res.status(200).json({ success: true, count: records.length, disruptions: records });
    } catch (error) {
      next(error);
    }
  };

  resolveDisruption = async (req: Request | AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      aiRepository.resolveDisruption(id);
      res.status(200).json({ success: true, message: `Disruption ${id} resolved` });
    } catch (error) {
      next(error);
    }
  };
}

export default new AIController();
