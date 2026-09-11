import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from conflicts.conflict_detector import detect_conflicts, PredictedOccupancy


def test_no_conflict_when_well_separated():
    occ = [
        PredictedOccupancy("A", "SEC1", None, "up", 1, eta_enter_sec=0, eta_exit_sec=100),
        PredictedOccupancy("B", "SEC1", None, "up", 1, eta_enter_sec=400, eta_exit_sec=500),
    ]
    conflicts = detect_conflicts(occ)
    assert len(conflicts) == 0


def test_detects_block_occupation_conflict():
    occ = [
        PredictedOccupancy("A", "SEC1", None, "up", 1, eta_enter_sec=0, eta_exit_sec=100),
        PredictedOccupancy("B", "SEC1", None, "up", 1, eta_enter_sec=50, eta_exit_sec=150),
    ]
    conflicts = detect_conflicts(occ)
    assert len(conflicts) == 1
    assert conflicts[0].severity == "CRITICAL"
    assert set(conflicts[0].trains) == {"A", "B"}


def test_detects_platform_conflict():
    occ = [
        PredictedOccupancy("A", "SECX", "PF1", "up", 1, eta_enter_sec=0, eta_exit_sec=100),
        PredictedOccupancy("B", "SECY", "PF1", "up", 1, eta_enter_sec=50, eta_exit_sec=150),
    ]
    conflicts = detect_conflicts(occ)
    assert any(c.conflict_type == "PLATFORM_CONFLICT" for c in conflicts)


def test_worst_severity_sorted_first():
    occ = [
        PredictedOccupancy("A", "SEC1", None, "up", 1, eta_enter_sec=0, eta_exit_sec=100),
        PredictedOccupancy("B", "SEC1", None, "up", 1, eta_enter_sec=105, eta_exit_sec=200),  # small gap -> MEDIUM/HIGH
        PredictedOccupancy("C", "SEC2", None, "up", 1, eta_enter_sec=0, eta_exit_sec=100),
        PredictedOccupancy("D", "SEC2", None, "up", 1, eta_enter_sec=50, eta_exit_sec=150),  # overlap -> CRITICAL
    ]
    conflicts = detect_conflicts(occ)
    assert conflicts[0].severity == "CRITICAL"
