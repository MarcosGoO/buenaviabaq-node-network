"""
Configuration management for ML service
"""
from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Server
    ml_service_port: int = 8000
    ml_service_host: str = "0.0.0.0"
    environment: Literal["development", "production", "test"] = "development"

    # Database
    database_url: str = "postgresql://postgres:password@localhost:5432/viabaq_db"

    # Model Settings
    model_type: Literal["lightgbm", "randomforest", "xgboost"] = "lightgbm"
    model_path: str = "./models/traffic_model.pkl"
    feature_scaler_path: str = "./models/scaler.pkl"

    # Training Settings
    train_test_split: float = 0.2
    random_state: int = 42
    n_estimators: int = 100
    max_depth: int = 10

    # Prediction Settings
    prediction_cache_ttl: int = 900  # 15 minutes

    # Logging
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()
