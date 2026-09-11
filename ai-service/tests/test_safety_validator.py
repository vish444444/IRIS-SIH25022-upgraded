import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from safety.safety_validator import SafetyValidator, NetworkState, TrainPlan


def test_blocked_sector_is_rejected():
    validator = SafetyValidator()
    plans = [TrainPlan("T104", "S18", None, "up", enters_at_sec=0, exits_at_sec=100, planned_speed_kmh=60)]
    state = NetworkState(blocked_sectors=["S18"])
    result = validator.validate(plans, state)
    assert result.safe is False
    assert any("BLOCKED" in r for r in result.reasons)


def test_headway_violation_is_rejected():
    validator = SafetyValidator()
    plans = [
        TrainPlan("A", "SEC1", None, "up", enters_at_sec=0, exits_at_sec=100, planned_speed_kmh=60),
        TrainPlan("B", "SEC1", None, "up", enters_at_sec=110, exits_at_sec=200, planned_speed_kmh=60),  # only 10s gap
    ]
    result = validator.validate(plans, NetworkState())
    assert result.safe is False


def test_sufficient_headway_passes():
    validator = SafetyValidator()
    plans = [
        TrainPlan("A", "SEC1", None, "up", enters_at_sec=0, exits_at_sec=100, planned_speed_kmh=60),
        TrainPlan("B", "SEC1", None, "up", enters_at_sec=300, exits_at_sec=400, planned_speed_kmh=60),
    ]
    result = validator.validate(plans, NetworkState())
    assert result.safe is True


def test_platform_conflict_is_rejected():
    validator = SafetyValidator()
    plans = [
        TrainPlan("A", "SECX", "PF1", "up", enters_at_sec=0, exits_at_sec=120, planned_speed_kmh=40, dwell_seconds=60),
        TrainPlan("B", "SECY", "PF1", "up", enters_at_sec=50, exits_at_sec=180, planned_speed_kmh=40, dwell_seconds=60),
    ]
    result = validator.validate(plans, NetworkState())
    assert result.safe is False


def test_speed_limit_violation_is_rejected():
    validator = SafetyValidator()
    plans = [TrainPlan("A", "SECX", None, "up", enters_at_sec=0, exits_at_sec=100, planned_speed_kmh=130)]
    state = NetworkState(section_speed_limits={"SECX": 80})
    result = validator.validate(plans, state)
    assert result.safe is False


def test_unsafe_manual_override_is_blocked():
    """
    Demonstrates SIH Demo Scenario 10: an unsafe manual override attempt
    (sending T205 into a sector already occupied by T099) must be
    rejected by the deterministic safety validator, with a clear reason.
    """
    validator = SafetyValidator()
    plans = [
        TrainPlan("T099", "S18", None, "up", enters_at_sec=0, exits_at_sec=200, planned_speed_kmh=60),
        TrainPlan("T205", "S18", None, "up", enters_at_sec=20, exits_at_sec=220, planned_speed_kmh=60),
    ]
    result = validator.validate(plans, NetworkState())
    assert result.safe is False
    assert any("T205" in r and "S18" in r for r in result.reasons)
