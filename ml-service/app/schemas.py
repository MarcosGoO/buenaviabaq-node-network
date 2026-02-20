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

    # Temporal prediction
    horizon_minutes: Optional[int] = 0


class PredictionRequest(BaseModel):
    """Request for traffic prediction"""
    features: FeatureVector
    explain: bool = False


class BatchPredictionRequest(BaseModel):
    """Request for batch predictions"""
    features_list: List[FeatureVector]


class PredictionResponse(BaseModel):
    """Response with traffic prediction"""
    road_id: int
    timestamp: datetime
    predicted_speed_kmh: float
    predicted_speed_lower: Optional[float] = None
    predicted_speed_upper: Optional[float] = None
    predicted_congestion_level: str
    confidence_score: Optional[float] = None
    shap_values: Optional[Dict[str, float]] = None
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


# ── Sprint 7.1.1 — Model Experimentation ────────────────────────────────────

class ExperimentRequest(BaseModel):
    """Request to run a model experiment"""
    model_type: str = Field(
        "xgboost",
        description="Model to experiment with: 'xgboost', 'prophet', 'lstm'",
    )
    hyperparameters: Optional[Dict[str, Any]] = None
    data_limit: Optional[int] = Field(
        None, description="Limit training rows (default: all)"
    )


class ExperimentMetrics(BaseModel):
    mae: float
    rmse: float
    r2: float
    mape: float
    training_samples: int
    test_samples: int


class ExperimentResult(BaseModel):
    model_type: str
    metrics: ExperimentMetrics
    params: Dict[str, Any]
    trained_at: str
    note: Optional[str] = None


class CompareModelsRequest(BaseModel):
    """Request to compare multiple models"""
    model_types: List[str] = Field(
        default=["xgboost", "lightgbm"],
        description="Models to compare. Options: 'xgboost', 'lightgbm', 'randomforest', 'prophet', 'lstm'",
    )
    hyperparameters: Optional[Dict[str, Dict[str, Any]]] = Field(
        None, description="Per-model hyperparameters, keyed by model_type"
    )
    data_limit: Optional[int] = None


class ModelComparisonEntry(BaseModel):
    model_type: str
    mae: float
    rmse: float
    r2: float
    mape: float
    training_samples: int
    test_samples: int
    trained_at: Optional[str] = None


class CompareModelsResponse(BaseModel):
    models: List[ModelComparisonEntry]
    best_model_by_mae: Optional[str] = None
    compared_at: str


# ── Sprint 7.1.2 — Hyperparameter Tuning ────────────────────────────────────

class TuningRequest(BaseModel):
    """Request to run hyperparameter tuning"""
    method: str = Field(
        "optuna",
        description="Tuning method: 'grid_search' or 'optuna'",
    )
    model_type: str = Field(
        "xgboost",
        description="Model to tune: 'xgboost' or 'lightgbm'",
    )
    n_trials: int = Field(
        20, ge=5, le=200, description="Number of Optuna trials (ignored for grid_search)"
    )
    cv_folds: int = Field(3, ge=2, le=10)
    data_limit: Optional[int] = None


class TuningResponse(BaseModel):
    method: str
    model_type: str
    best_params: Dict[str, Any]
    best_mae: float
    cv_folds: int
    n_trials: Optional[int] = None
    n_combinations: Optional[int] = None
    timestamp: str
    params_saved_to: str = "./models/best_params.json"


# ── Sprint 7.1.3 — Temporal Cross-Validation ────────────────────────────────

class CrossValidationRequest(BaseModel):
    """Request to run TimeSeriesSplit cross-validation"""
    model_type: str = Field(
        "xgboost",
        description="Model type: 'xgboost', 'lightgbm', 'randomforest'",
    )
    n_splits: int = Field(5, ge=2, le=10)
    hyperparameters: Optional[Dict[str, Any]] = None
    data_limit: Optional[int] = None


class FoldMetrics(BaseModel):
    fold: int
    mae: Optional[float] = None
    rmse: Optional[float] = None
    r2: Optional[float] = None
    mape: Optional[float] = None
    train_size: int
    test_size: int
    error: Optional[str] = None


class AggregatedMetric(BaseModel):
    mean: float
    std: float
    min: float
    max: float


class AggregatedMetrics(BaseModel):
    mae: Optional[AggregatedMetric] = None
    rmse: Optional[AggregatedMetric] = None
    r2: Optional[AggregatedMetric] = None
    mape: Optional[AggregatedMetric] = None
    successful_folds: int


class CrossValidationResponse(BaseModel):
    model_type: str
    n_splits: int
    folds: List[FoldMetrics]
    aggregated: AggregatedMetrics
    total_samples: int
    validated_at: str
