"""
Pydantic schemas for request/response validation
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class FeatureVector(BaseModel):
    """Feature vector for prediction"""
    road_id: int
    timestamp: Optional[datetime] = None

    # Temporal features
    hour_of_day: int = Field(..., ge=0, le=23)
    day_of_week: int = Field(..., ge=0, le=6)
    day_of_month: int = Field(..., ge=1, le=31)
    month: int = Field(..., ge=1, le=12)
    is_rush_hour: bool
    is_weekend: bool

    # Traffic historical features
    avg_speed_historical: Optional[float] = None
    avg_congestion_level_encoded: Optional[float] = Field(None, ge=0, le=1)
    traffic_std_deviation: Optional[float] = None

    # Weather features
    temperature: Optional[float] = None
    humidity: Optional[float] = Field(None, ge=0, le=100)
    wind_speed: Optional[float] = None
    rain_probability: Optional[float] = Field(None, ge=0, le=100)
    weather_condition_encoded: Optional[int] = Field(None, ge=0, le=5)
    is_raining: bool = False

    # Event features
    event_nearby: bool = False
    event_type_encoded: Optional[int] = Field(None, ge=0, le=7)
    event_distance_km: Optional[float] = None

    # Geographic features
    zone_id: Optional[int] = None
    road_type_encoded: Optional[int] = Field(None, ge=0, le=4)
    lanes: Optional[int] = None
    max_speed_kmh: Optional[int] = None

    # Arroyo risk features
    arroyo_nearby: bool = False
    arroyo_risk_level_encoded: Optional[float] = Field(None, ge=0, le=1)
    arroyo_distance_km: Optional[float] = None


class PredictionRequest(BaseModel):
    """Request for traffic prediction"""
    features: FeatureVector


class BatchPredictionRequest(BaseModel):
    """Request for batch predictions"""
    features_list: List[FeatureVector]


class PredictionResponse(BaseModel):
    """Response with traffic prediction"""
    road_id: int
    timestamp: datetime
    predicted_speed_kmh: float
    predicted_congestion_level: str
    confidence_score: Optional[float] = None
    model_version: str


class BatchPredictionResponse(BaseModel):
    """Response for batch predictions"""
    predictions: List[PredictionResponse]
    count: int


class TrainingRequest(BaseModel):
    """Request to trigger model training"""
    model_type: Optional[str] = "lightgbm"
    hyperparameters: Optional[Dict[str, Any]] = None
    force_retrain: bool = False


class TrainingResponse(BaseModel):
    """Response after training"""
    status: str
    message: str
    metrics: Optional[Dict[str, float]] = None
    training_samples: int
    test_samples: int
    model_path: str
    timestamp: datetime


class ModelMetrics(BaseModel):
    """Model evaluation metrics"""
    mae: float  # Mean Absolute Error
    rmse: float  # Root Mean Squared Error
    r2: float  # R-squared
    mape: Optional[float] = None  # Mean Absolute Percentage Error
    training_samples: int
    test_samples: int
    model_type: str
    timestamp: datetime


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    timestamp: datetime
    model_loaded: bool
    database_connected: bool
    version: str
    uptime_seconds: float


class FeatureImportance(BaseModel):
    """Feature importance from model"""
    feature_name: str
    importance_score: float


class ModelInfoResponse(BaseModel):
    """Model information response"""
    model_type: str
    model_version: str
    trained_at: Optional[datetime] = None
    training_samples: int
    metrics: Optional[ModelMetrics] = None
    feature_importance: Optional[List[FeatureImportance]] = None
