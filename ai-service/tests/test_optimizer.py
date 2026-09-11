import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from optimization.optimizer import optimize_precedence, TrainRequest


def test_higher_priority_train_is_favored():
    reqs = [
        TrainRequest("HIGH", "SEC1", priority=1, requested_entry_sec=60, transit_seconds=90),
        TrainRequest("LOW", "SEC1", priority=5, requested_entry_sec=90, transit_seconds=90),
    ]
    result = optimize_precedence(reqs)
    assert result["feasible"] is True
    best = result["options"][0]
    # HIGH priority train should not be the one held in the best solution
    assert best.assignments["HIGH"]["hold_sec"] == 0


def test_generates_alternatives_for_each_train():
    reqs = [
        TrainRequest("A", "SEC1", priority=2, requested_entry_sec=60, transit_seconds=90),
        TrainRequest("B", "SEC1", priority=2, requested_entry_sec=90, transit_seconds=90),
    ]
    result = optimize_precedence(reqs, generate_alternatives=True)
    assert len(result["options"]) == 2


def test_single_train_no_holding_needed():
    reqs = [TrainRequest("SOLO", "SEC1", priority=3, requested_entry_sec=60, transit_seconds=90)]
    result = optimize_precedence(reqs)
    assert result["options"][0].assignments["SOLO"]["hold_sec"] == 0


def test_headway_is_respected_in_solution():
    reqs = [
        TrainRequest("A", "SEC1", priority=1, requested_entry_sec=0, transit_seconds=60),
        TrainRequest("B", "SEC1", priority=1, requested_entry_sec=10, transit_seconds=60),
    ]
    result = optimize_precedence(reqs)
    best = result["options"][0]
    entries = sorted(a["entry_sec"] for a in best.assignments.values())
    # second entry must be at least transit(60) + headway(120) after the first
    assert entries[1] - entries[0] >= 60 + 120 - 1  # allow rounding


def test_predicted_delay_changes_holding_cost():
    baseline = optimize_precedence([
        TrainRequest("A", "SEC1", priority=3, requested_entry_sec=0, transit_seconds=60),
        TrainRequest("B", "SEC1", priority=3, requested_entry_sec=10, transit_seconds=60),
    ], generate_alternatives=False)
    predicted = optimize_precedence([
        TrainRequest("A", "SEC1", priority=3, requested_entry_sec=0, transit_seconds=60),
        TrainRequest("B", "SEC1", priority=3, requested_entry_sec=10, transit_seconds=60, predicted_delay_min=100),
    ], generate_alternatives=False)

    assert predicted["feasible"] is True
    assert predicted["options"][0].assignments["B"]["hold_sec"] == 0
    assert predicted["options"][0].assignments["A"]["hold_sec"] > 0


def test_destination_delay_includes_prediction_and_hold():
    result = optimize_precedence([
        TrainRequest(
            "A",
            "SEC1",
            priority=1,
            requested_entry_sec=0,
            transit_seconds=60,
            current_delay_min=2,
            predicted_delay_min=5,
            scheduled_destination_arrival_sec=3600,
        ),
    ])
    assignment = result["options"][0].assignments["A"]
    assert assignment["predicted_destination_delay_min"] == 7.0
    assert assignment["destination_eta_sec"] == 4020


def test_runtime_is_fast_enough_for_demo():
    # 6 trains contending for one resource; each needs 90s transit + 120s headway,
    # so full serialization needs ~1050s of spread -- give enough max_hold_seconds
    # headroom (2000s) so the scenario is actually feasible, and assert the solver
    # still finds it fast.
    reqs = [
        TrainRequest(f"T{i}", "SEC1", priority=(i % 5) + 1, requested_entry_sec=i * 30,
                     transit_seconds=90, max_hold_seconds=2000)
        for i in range(6)
    ]
    result = optimize_precedence(reqs)
    assert result["feasible"] is True
    assert result["runtime_sec"] < 5.0
