"""
FastAPI application for ML service
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import time
from datetime import datetime
from pathlib import Path

from .config import settings
from .schemas import (
    PredictionRequest,
    PredictionResponse,
    BatchPredictionRequest,
    BatchPredictionResponse,
    TrainingRequest,
    TrainingResponse,
    HealthResponse,
    ModelInfoResponse,
    ModelMetrics,
    FeatureImportance
)
from .model import model_manager
from .database import db

# Configure logging
logging.basicConfig(
    level=settings.log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Application start time
start_time = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events"""
    # Startup
    logger.info("Starting ML service...")

    # Connect to database
    try:
        db.connect()
        logger.info("Database connected")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")

    # Try to load existing model
    try:
        if Path(settings.model_path).exists():
            model_manager.load_model()
            logger.info("Existing model loaded successfully")
        else:
            logger.warning("No existing model found. Train a model via /train endpoint")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")

    yield

    # Shutdown
    logger.info("Shutting down ML service...")
    db.disconnect()


app = FastAPI(
    title="VíaBaq ML Service",
    description="Machine Learning service for traffic prediction in Barranquilla",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["General"])
async def root():
    """Root endpoint"""
    return {
        "service": "VíaBaq ML Service",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health", response_model=HealthResponse, tags=["General"])
async def health_check():
    """Health check endpoint"""
    model = model_manager.get_model()

    # Test database connection
    db_connected = False
    try:
        db.get_feature_stats()
        db_connected = True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")

    uptime = time.time() - start_time

    return HealthResponse(
        status="healthy" if (model and db_connected) else "degraded",
        timestamp=datetime.now(),
        model_loaded=model is not None,
        database_connected=db_connected,
        version="1.0.0",
        uptime_seconds=uptime
    )


@app.get("/model/info", response_model=ModelInfoResponse, tags=["Model"])
async def get_model_info():
    """Get information about the current model"""
    model = model_manager.get_model()

    if not model:
        raise HTTPException(status_code=404, detail="No model loaded")

    # Get feature importance
    importance_dict = model.get_feature_importance()
    feature_importance = [
        FeatureImportance(feature_name=name, importance_score=score)
        for name, score in sorted(
            importance_dict.items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]  # Top 10 features
    ]

    metrics = None
    if model.metrics:
        metrics = ModelMetrics(
            mae=model.metrics['mae'],
            rmse=model.metrics['rmse'],
            r2=model.metrics['r2'],
            mape=model.metrics.get('mape'),
            training_samples=model.training_samples,
            test_samples=model.test_samples,
            model_type=model.model_type,
            timestamp=model.trained_at or datetime.now()
        )

    return ModelInfoResponse(
        model_type=model.model_type,
        model_version=model.model_version,
        trained_at=model.trained_at,
        training_samples=model.training_samples,
        metrics=metrics,
        feature_importance=feature_importance if feature_importance else None
    )


@app.post("/predict", response_model=PredictionResponse, tags=["Prediction"])
async def predict_traffic(request: PredictionRequest):
    """
    Predict traffic speed for a road

    Args:
        request: Prediction request with feature vector

    Returns:
        Prediction response with predicted speed and congestion level
    """
    model = model_manager.get_model()

    if not model:
        raise HTTPException(status_code=503, detail="No model loaded. Train a model first.")

    try:
        # Extract features
        features_dict = request.features.model_dump()

        # Make prediction
        predicted_speed, congestion_level = model_manager.predict(features_dict)

        return PredictionResponse(
            road_id=request.features.road_id,
            timestamp=request.features.timestamp or datetime.now(),
            predicted_speed_kmh=predicted_speed,
            predicted_congestion_level=congestion_level,
            confidence_score=None,  # TODO: Implement confidence estimation
            model_version=model.model_version
        )

    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/predict/batch", response_model=BatchPredictionResponse, tags=["Prediction"])
async def predict_batch(request: BatchPredictionRequest):
    """
    Batch prediction for multiple roads

    Args:
        request: Batch prediction request

    Returns:
        Batch prediction response
    """
    model = model_manager.get_model()

    if not model:
        raise HTTPException(status_code=503, detail="No model loaded. Train a model first.")

    try:
        predictions = []

        for features in request.features_list:
            features_dict = features.model_dump()
            predicted_speed, congestion_level = model_manager.predict(features_dict)

            predictions.append(
                PredictionResponse(
                    road_id=features.road_id,
                    timestamp=features.timestamp or datetime.now(),
                    predicted_speed_kmh=predicted_speed,
                    predicted_congestion_level=congestion_level,
                    model_version=model.model_version
                )
            )

        return BatchPredictionResponse(
            predictions=predictions,
            count=len(predictions)
        )

    except Exception as e:
        logger.error(f"Batch prediction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Batch prediction failed: {str(e)}")


def train_model_background(
    model_type: str,
    hyperparameters: dict = None
):
    """Background task for model training"""
    try:
        logger.info(f"Starting model training: {model_type}")
        model, metrics = model_manager.train_new_model(
            model_type=model_type,
            hyperparameters=hyperparameters
        )
        logger.info(f"Model training completed. Metrics: {metrics}")
    except Exception as e:
        logger.error(f"Background training failed: {e}")


@app.post("/train", response_model=TrainingResponse, tags=["Training"])
async def train_model(request: TrainingRequest, background_tasks: BackgroundTasks):
    """
    Train a new model

    Args:
        request: Training request with model type and hyperparameters
        background_tasks: FastAPI background tasks

    Returns:
        Training response with status and metrics
    """
    model_type = request.model_type or settings.model_type

    # Check if model already exists and force_retrain is False
    if not request.force_retrain and Path(settings.model_path).exists():
        return TrainingResponse(
            status="skipped",
            message="Model already exists. Use force_retrain=true to retrain.",
            metrics=None,
            training_samples=0,
            test_samples=0,
            model_path=settings.model_path,
            timestamp=datetime.now()
        )

    try:
        # Train model (synchronous for now, can be made async)
        logger.info(f"Training {model_type} model...")
        model, metrics = model_manager.train_new_model(
            model_type=model_type,
            hyperparameters=request.hyperparameters
        )

        return TrainingResponse(
            status="success",
            message=f"Model trained successfully using {model_type}",
            metrics=metrics,
            training_samples=model.training_samples,
            test_samples=model.test_samples,
            model_path=settings.model_path,
            timestamp=datetime.now()
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Training failed: {e}")
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


@app.get("/features/stats", tags=["Data"])
async def get_feature_stats():
    """Get statistics about available training data"""
    try:
        stats = db.get_feature_stats()
        return {
            "status": "success",
            "data": stats,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to get feature stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.ml_service_host,
        port=settings.ml_service_port,
        reload=settings.environment == "development"
    )
