"""
adapters.py
============
Adapter INTERFACES for future integration with real railway systems.
Every implementation in this file is a MOCK used for the hackathon
demo. None of these connect to real Indian Railways infrastructure.

Where a real system would plug in is documented on each class. To
integrate a real system, implement the same abstract interface and
swap the instance created in api/main.py (dependency injection point
`get_adapters()`).
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any


class TelemetryAdapter(ABC):
    """Real integration point: signalling-grade GPS/AFTC train telemetry feed."""
    @abstractmethod
    def get_live_trains(self) -> List[Dict[str, Any]]:
        ...


class SignallingAdapter(ABC):
    """Real integration point: Electronic Interlocking / signalling system."""
    @abstractmethod
    def get_signal_states(self, section_ids: List[str]) -> Dict[str, str]:
        ...


class TimetableAdapter(ABC):
    """Real integration point: Indian Railways timetable / COIS-DMS system."""
    @abstractmethod
    def get_schedule(self, train_id: str) -> Dict[str, Any]:
        ...


class RollingStockAdapter(ABC):
    """Real integration point: rolling stock maintenance/availability system."""
    @abstractmethod
    def get_rake_status(self, train_id: str) -> Dict[str, Any]:
        ...


class TrackStatusAdapter(ABC):
    """Real integration point: IRIS Node.js backend `/api/status` endpoints (already implemented)."""
    @abstractmethod
    def get_blocked_sectors(self) -> List[str]:
        ...


# ---------------------------------------------------------------------------
# MOCK implementations used for the demo. Clearly labelled as MOCK.
# ---------------------------------------------------------------------------

class MockTelemetryAdapter(TelemetryAdapter):
    def get_live_trains(self) -> List[Dict[str, Any]]:
        return []  # In the real system this is replaced by calling the Node API/receiver.


class MockSignallingAdapter(SignallingAdapter):
    def get_signal_states(self, section_ids: List[str]) -> Dict[str, str]:
        return {sid: "PROCEED" for sid in section_ids}


class MockTimetableAdapter(TimetableAdapter):
    def get_schedule(self, train_id: str) -> Dict[str, Any]:
        return {"train_id": train_id, "source": "MOCK", "stops": []}


class MockRollingStockAdapter(RollingStockAdapter):
    def get_rake_status(self, train_id: str) -> Dict[str, Any]:
        return {"train_id": train_id, "status": "IN_SERVICE", "source": "MOCK"}


class MockTrackStatusAdapter(TrackStatusAdapter):
    def get_blocked_sectors(self) -> List[str]:
        return []  # Real system: proxy to Node `/api/status/sector-blockages`


def get_default_adapters() -> Dict[str, Any]:
    return {
        "telemetry": MockTelemetryAdapter(),
        "signalling": MockSignallingAdapter(),
        "timetable": MockTimetableAdapter(),
        "rolling_stock": MockRollingStockAdapter(),
        "track_status": MockTrackStatusAdapter(),
    }
