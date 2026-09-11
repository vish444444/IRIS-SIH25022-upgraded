import { initializeDatabase } from "../db/database";
import aiRepository from "../db/repositories/aiRepository";

beforeAll(() => {
  initializeDatabase();
});

describe("aiRepository (real SQLite, isolated test DB)", () => {
  it("creates and retrieves a conflict record", () => {
    const created = aiRepository.createConflict({
      conflict_type: "HEADWAY_VIOLATION",
      severity: "HIGH",
      trains: JSON.stringify(["T102", "T205"]),
      location: "DADAR-KURLA",
      predicted_time_sec: 90,
      probability: 0.87,
      reason: "test conflict",
      resolved: 0,
    });
    expect(created.id).toBeDefined();

    const fetched = aiRepository.findConflictById(created.id);
    expect(fetched?.severity).toBe("HIGH");
    expect(JSON.parse(fetched!.trains)).toEqual(["T102", "T205"]);
  });

  it("creates a recommendation and transitions its status", () => {
    const rec = aiRepository.createRecommendation({
      resource_id: "DADAR-JN",
      label: "Hold T205 for 90s",
      is_safe: 1,
      total_weighted_delay_sec: 540,
      objective_value: 54000,
      confidence: 0.85,
      raw_json: JSON.stringify({ ok: true }),
      status: "pending",
    });
    expect(rec.status).toBe("pending");

    const updated = aiRepository.decideRecommendation(rec.id, "approved", "controller_1");
    expect(updated?.status).toBe("approved");
    expect(updated?.decided_by).toBe("controller_1");
  });

  it("logs an optimization run and lists it back", () => {
    const id = aiRepository.logOptimizationRun({
      n_trains: 2,
      feasible: true,
      runtime_sec: 0.02,
      n_options: 2,
      raw_json: JSON.stringify({ ok: true }),
    });
    expect(id).toBeDefined();
    const runs = aiRepository.listOptimizationRuns(5) as any[];
    expect(runs.find((r) => r.id === id)).toBeTruthy();
  });

  it("creates and resolves a disruption", () => {
    const disruption: any = aiRepository.createDisruption({
      disruption_type: "track_blockage",
      resource_id: "S18",
      description: "test blockage",
    });
    expect(disruption.active).toBe(1);

    const activeBefore = aiRepository.listActiveDisruptions() as any[];
    expect(activeBefore.some((d) => d.id === disruption.id)).toBe(true);

    aiRepository.resolveDisruption(disruption.id);
    const activeAfter = aiRepository.listActiveDisruptions() as any[];
    expect(activeAfter.some((d) => d.id === disruption.id)).toBe(false);
  });
});
