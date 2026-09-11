import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from api.main import app


def test_full_recommend_pipeline_returns_safe_ranked_options():
    with TestClient(app) as client:
        r = client.post("/ai/recommend", json={
            "conflict_trains": [
                {"train_id": "T102", "resource_id": "DADAR-JN", "priority": 1, "requested_entry_sec": 60, "transit_seconds": 90},
                {"train_id": "T205", "resource_id": "DADAR-JN", "priority": 3, "requested_entry_sec": 90, "transit_seconds": 90},
            ]
        })
        assert r.status_code == 200
        body = r.json()
        assert len(body["recommendations"]) >= 1
        assert body["recommendations"][0]["safety_status"] == "PASS"
        assert body["recommendations"][0]["rank"] == 1


def test_delay_prediction_is_carried_into_recommendation_optimization():
    with TestClient(app) as client:
        r = client.post("/ai/recommend", json={
            "conflict_trains": [
                {
                    "train_id": "T102",
                    "resource_id": "DADAR-JN",
                    "priority": 1,
                    "requested_entry_sec": 60,
                    "transit_seconds": 90,
                    "prediction": {
                        "current_delay_min": 12,
                        "train_type": "fast",
                        "current_speed_kmh": 18,
                        "section_occupancy": 0.8,
                        "trains_ahead": 3,
                        "disruption_active": True,
                    },
                },
                {
                    "train_id": "T205",
                    "resource_id": "DADAR-JN",
                    "priority": 3,
                    "requested_entry_sec": 90,
                    "transit_seconds": 90,
                },
            ]
        })
        assert r.status_code == 200
        top = r.json()["recommendations"][0]
        assert "T102" in top["predicted_delay_by_train"]
        assert top["predicted_delay_by_train"]["T102"] >= 0
        assert top["expected_impact"]["per_train"]["T102"]["predicted_delay_min"] >= 0


def test_blocked_sector_what_if_is_rejected_by_safety_validator():
    with TestClient(app) as client:
        r = client.post("/ai/what-if", json={
            "scenario_name": "blocked_sector",
            "blocked_sectors": ["S12"],
            "trains": [
                {"train_id": "A", "resource_id": "S12", "requested_entry_sec": 0, "transit_seconds": 60},
                {"train_id": "B", "resource_id": "S12", "requested_entry_sec": 30, "transit_seconds": 60},
            ],
        })
        assert r.status_code == 200
        body = r.json()
        assert body["ai_optimized"]["safety"]["safe"] is False
        assert any("BLOCKED" in reason for reason in body["ai_optimized"]["safety"]["reasons"])


def test_what_if_baseline_vs_optimized_have_real_numbers():
    with TestClient(app) as client:
        r = client.post("/ai/what-if", json={
            "scenario_name": "test_scenario",
            "trains": [
                {"train_id": "A", "resource_id": "SEC1", "priority": 1, "requested_entry_sec": 0, "transit_seconds": 60},
                {"train_id": "B", "resource_id": "SEC1", "priority": 5, "requested_entry_sec": 30, "transit_seconds": 60},
            ]
        })
        assert r.status_code == 200
        body = r.json()
        assert body["baseline"]["total_weighted_delay_sec"] >= body["ai_optimized"]["total_weighted_delay_sec"]


def test_unsafe_override_rejected_end_to_end():
    """SIH Demo Scenario 10: unsafe manual override must be rejected with a reason."""
    with TestClient(app) as client:
        r = client.post("/ai/override", json={
            "plans": [
                {"train_id": "T099", "section_id": "S18", "enters_at_sec": 0, "exits_at_sec": 200, "planned_speed_kmh": 60},
                {"train_id": "T205", "section_id": "S18", "enters_at_sec": 20, "exits_at_sec": 220, "planned_speed_kmh": 60},
            ],
            "user_id": "controller_1",
            "reason": "manual override attempt",
        })
        assert r.status_code == 200
        body = r.json()
        assert body["override_allowed"] is False
        assert len(body["reasons"]) > 0


def test_status_endpoint_reports_all_components_implemented():
    with TestClient(app) as client:
        r = client.get("/ai/status")
        body = r.json()
        for key in ["delay_prediction", "conflict_detection", "optimization_engine", "safety_validator"]:
            assert "IMPLEMENTED" in body["components"][key]
