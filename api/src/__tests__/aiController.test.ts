import AIServiceClient from "../services/ai/aiServiceClient";
import aiRepository from "../db/repositories/aiRepository";
import { initializeDatabase } from "../db/database";

beforeAll(() => {
  initializeDatabase();
});

// Mock the AI service HTTP client so this test never needs a live Python
// process -- it verifies the Node proxy/persistence logic in isolation.
jest.mock("../services/ai/aiServiceClient");

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("ai.controller", () => {
  beforeEach(() => {
    (AIServiceClient.getInstance as jest.Mock) = jest.fn();
  });

  it("recommend() persists the top recommendation and returns it", async () => {
    const fakeClient = {
      recommend: jest.fn().mockResolvedValue({
        recommendation_id: "REC-abc123",
        runtime_sec: 0.03,
        recommendations: [
          {
            rank: 1,
            label: "Hold T205 to let T102 proceed first",
            safety_status: "PASS",
            confidence: 0.85,
            expected_impact: { total_weighted_delay_sec: 540, total_weighted_delay_min: 9 },
          },
        ],
      }),
    };
    (AIServiceClient.getInstance as jest.Mock).mockReturnValue(fakeClient);
    // Re-instantiate controller's internal client reference by creating a fresh instance
    const controllerModule = require("../controller/ai.controller");
    const controller = new controllerModule.AIController();

    const req: any = { body: { conflict_trains: [{ resource_id: "DADAR-JN" }] } };
    const res = mockRes();
    const next = jest.fn();

    await controller.recommend(req, res, next);

    expect(fakeClient.recommend).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.saved_recommendation_id).toBeDefined();

    const saved = aiRepository.findRecommendationById(payload.saved_recommendation_id);
    expect(saved?.label).toBe("Hold T205 to let T102 proceed first");
    expect(saved?.is_safe).toBe(1);
  });

  it("override() blocks an unsafe override and logs it without approving", async () => {
    const fakeClient = {
      override: jest.fn().mockResolvedValue({
        override_allowed: false,
        reasons: ["Train T205 cannot enter sector S18 because it is occupied by T099."],
      }),
    };
    (AIServiceClient.getInstance as jest.Mock).mockReturnValue(fakeClient);
    const controllerModule = require("../controller/ai.controller");
    const controller = new controllerModule.AIController();

    const req: any = {
      body: { plans: [], original_recommendation_id: undefined },
      user: undefined, // no fake user id -- audit_logs.actor_id has a real FK to users(id)
      headers: {},
      socket: {},
    };
    const res = mockRes();
    const next = jest.fn();

    await controller.override(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    const payload = res.json.mock.calls[0][0];
    expect(payload.override_allowed).toBe(false);
    expect(payload.reasons.length).toBeGreaterThan(0);
  });
});
