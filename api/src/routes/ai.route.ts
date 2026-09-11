import { Router } from "express";
import aiController from "../controller/ai.controller";
import { authenticate, requirePermission } from "../middleware/rbac.middleware";

const router = Router();

// Status is public-ish (read-only, no sensitive data) so the dashboard can
// show AI health without forcing a login screen first; everything that
// triggers computation or writes state requires authentication.
router.get("/status", aiController.status);

router.post("/predict-delay", authenticate, aiController.predictDelay);
router.post("/detect-conflicts", authenticate, aiController.detectConflicts);
router.post("/optimize", authenticate, aiController.optimize);
router.post("/validate", authenticate, aiController.validate);

router.post("/recommend", authenticate, requirePermission("dashboard:read"), aiController.recommend);
router.get("/recommendations", authenticate, requirePermission("dashboard:read"), aiController.getRecommendations);
router.post(
  "/recommendations/:id/decide",
  authenticate,
  requirePermission("decision:accept"),
  aiController.decideRecommendation
);

router.post("/override", authenticate, requirePermission("decision:override"), aiController.override);
router.post("/what-if", authenticate, requirePermission("dashboard:read"), aiController.whatIf);

router.get("/optimization-runs", authenticate, requirePermission("dashboard:read"), aiController.getOptimizationRuns);
router.get("/conflicts", authenticate, requirePermission("dashboard:read"), aiController.getConflicts);

router.post("/disruptions", authenticate, requirePermission("decision:override"), aiController.createDisruption);
router.get("/disruptions", authenticate, requirePermission("dashboard:read"), aiController.listDisruptions);
router.delete("/disruptions/:id", authenticate, requirePermission("decision:override"), aiController.resolveDisruption);

export default router;
