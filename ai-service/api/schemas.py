from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class DelayPredictRequest(BaseModel):
    current_delay_min: float = 0.0
    train_type: str = "slow"
    priority: int = 3
    current_speed_kmh: float = 0.0
    previous_speed_kmh: float = 0.0
    dwell_time_sec: float = 0.0
    distance_to_next_km: float = 1.0
    section_occupancy: float = 0.0
    trains_ahead: int = 0
    platform_available: bool = True
    disruption_active: bool = False
    scheduled_headway_sec: float = 240.0


class DelayPredictResponse(BaseModel):
    predicted_future_delay_min: float
    congestion_index: float
    model_type: str
    model_metrics: Dict[str, Any]


class TrainOccupancyInput(BaseModel):
    train_id: str
    section_id: str
    platform_id: Optional[str] = None
    direction: str = "up"
    priority: int = 3
    eta_enter_sec: float
    eta_exit_sec: float


class ConflictDetectRequest(BaseModel):
    occupancies: List[TrainOccupancyInput]
    single_line_sections: List[str] = Field(default_factory=list)


class TrainRequestInput(BaseModel):
    train_id: str
    resource_id: str
    priority: int = 3
    requested_entry_sec: int
    transit_seconds: int
    max_hold_seconds: int = 600
    reroute_available: bool = False
    reroute_extra_seconds: int = 0
    prediction: Optional[DelayPredictRequest] = None
    current_delay_min: float = 0.0
    scheduled_destination_arrival_sec: Optional[int] = None


class OptimizeRequest(BaseModel):
    requests: List[TrainRequestInput]
    generate_alternatives: bool = True
    blocked_sectors: List[str] = Field(default_factory=list)
    single_line_sections: List[str] = Field(default_factory=list)
    section_speed_limits: Dict[str, float] = Field(default_factory=dict)


class TrainPlanInput(BaseModel):
    train_id: str
    section_id: str
    platform_id: Optional[str] = None
    direction: str = "up"
    enters_at_sec: float
    exits_at_sec: float
    planned_speed_kmh: float = 60.0
    dwell_seconds: float = 0.0


class ValidateRequest(BaseModel):
    plans: List[TrainPlanInput]
    blocked_sectors: List[str] = Field(default_factory=list)
    single_line_sections: List[str] = Field(default_factory=list)
    section_speed_limits: Dict[str, float] = Field(default_factory=dict)


class RecommendRequest(BaseModel):
    conflict_trains: List[TrainRequestInput]
    blocked_sectors: List[str] = Field(default_factory=list)
    single_line_sections: List[str] = Field(default_factory=list)
    section_speed_limits: Dict[str, float] = Field(default_factory=dict)
    transit_seconds_by_train: Dict[str, int] = Field(default_factory=dict)


class OverrideRequest(BaseModel):
    plans: List[TrainPlanInput]
    blocked_sectors: List[str] = Field(default_factory=list)
    single_line_sections: List[str] = Field(default_factory=list)
    section_speed_limits: Dict[str, float] = Field(default_factory=dict)
    user_id: Optional[str] = None
    reason: Optional[str] = None
    original_recommendation_id: Optional[str] = None


class WhatIfTrain(BaseModel):
    train_id: str
    resource_id: str
    priority: int = 3
    requested_entry_sec: int
    transit_seconds: int
    prediction: Optional[DelayPredictRequest] = None
    current_delay_min: float = 0.0
    scheduled_destination_arrival_sec: Optional[int] = None


class WhatIfRequest(BaseModel):
    trains: List[WhatIfTrain]
    scenario_name: str = "custom"
    blocked_sectors: List[str] = Field(default_factory=list)
    single_line_sections: List[str] = Field(default_factory=list)
    section_speed_limits: Dict[str, float] = Field(default_factory=dict)
