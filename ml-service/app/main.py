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
    FeatureImportance,
    # Sprint 7 schemas
    ExperimentRequest,
    ExperimentResult,
    ExperimentMetrics,
    CompareModelsRequest,
    CompareModelsResponse,
    ModelComparisonEntry,
    TuningRequest,
    TuningResponse,
    CrossValidationRequest,
    CrossValidationResponse,
    FoldMetrics,
    AggregatedMetrics,
    AggregatedMetric,
)
from .model import model_manager
from .database import db
from .ml_experiments import (
    train_xgboost_experiment,
    train_prophet_experiment,
    train_lstm_experiment,
    compare_models,
)
from .hyperparameter_tuning import (
    run_grid_search_xgboost,
    run_optuna_xgboost,
    run_optuna_lightgbm,
    load_best_params,
)
from .cross_validation import run_timeseries_cv, load_cv_results
from .preprocessing import preprocessor

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
        predicted_speed, congestion_level, explanation = model_manager.predict(features_dict, explain=request.explain)
        
        horizon = features_dict.get('horizon_minutes', 0)
        # Simplified error margin based on horizon: +/- 5% per 15 mins
        margin_factor = 1.0 + (horizon / 15.0) * 0.05
        lower = max(0, predicted_speed / margin_factor)
        upper = predicted_speed * margin_factor
        confidence = max(0, 100 - horizon * 0.4)

        return PredictionResponse(
            road_id=request.features.road_id,
            timestamp=request.features.timestamp or datetime.now(),
            predicted_speed_kmh=predicted_speed,
            predicted_speed_lower=lower,
            predicted_speed_upper=upper,
            predicted_congestion_level=congestion_level,
            confidence_score=confidence,
            shap_values=explanation,
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
            predicted_speed, congestion_level, explanation = model_manager.predict(features_dict, explain=False) # Skip batch explain to save time

            horizon = features_dict.get('horizon_minutes', 0)
            margin_factor = 1.0 + (horizon / 15.0) * 0.05
            lower = max(0, predicted_speed / margin_factor)
            upper = predicted_speed * margin_factor
            confidence = max(0, 100 - horizon * 0.4)

            predictions.append(
                PredictionResponse(
                    road_id=features.road_id,
                    timestamp=features.timestamp or datetime.now(),
                    predicted_speed_kmh=predicted_speed,
                    predicted_speed_lower=lower,
                    predicted_speed_upper=upper,
                    predicted_congestion_level=congestion_level,
                    confidence_score=confidence,
                    shap_values=explanation,
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


# ── Sprint 7.1.1 — Model Experimentation endpoints ──────────────────────────

@app.post("/models/experiment", response_model=ExperimentResult, tags=["Experiments"])
async def run_experiment(request: ExperimentRequest):
    """
    Train and evaluate a single model type (xgboost, prophet, lstm).
    Returns metrics without replacing the production model.
    """
    try:
        training_data = db.fetch_training_data(limit=request.data_limit)
        if len(training_data) < 20:
            raise HTTPException(status_code=422, detail="Insufficient training data (need ≥ 20 records).")

        model_type = request.model_type.lower()
        hp = request.hyperparameters or {}

        if model_type == "prophet":
            result = train_prophet_experiment(training_data, hyperparameters=hp)
        else:
            X, y = preprocessor.prepare_training_data(training_data)
            if model_type == "xgboost":
                result = train_xgboost_experiment(X, y, hyperparameters=hp)
            elif model_type == "lstm":
                result = train_lstm_experiment(X, y, hyperparameters=hp)
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported model_type: '{model_type}'. Use 'xgboost', 'prophet', or 'lstm'.")

        metrics = result["metrics"]
        return ExperimentResult(
            model_type=result["model_type"],
            metrics=ExperimentMetrics(**metrics),
            params=result.get("params", {}),
            trained_at=result["trained_at"],
            note=result.get("note"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Experiment failed: {e}")
        raise HTTPException(status_code=500, detail=f"Experiment failed: {str(e)}")


@app.post("/models/compare", response_model=CompareModelsResponse, tags=["Experiments"])
async def compare_all_models(request: CompareModelsRequest):
    """
    Train and compare multiple models side-by-side.
    Returns a ranked comparison table by MAE.
    """
    try:
        training_data = db.fetch_training_data(limit=request.data_limit)
        if len(training_data) < 20:
            raise HTTPException(status_code=422, detail="Insufficient training data (need ≥ 20 records).")

        results = []
        X = None
        y = None

        for model_type in request.model_types:
            model_type = model_type.lower()
            hp = (request.hyperparameters or {}).get(model_type, {})

            try:
                if model_type == "prophet":
                    r = train_prophet_experiment(training_data, hyperparameters=hp)
                else:
                    if X is None:
                        X, y = preprocessor.prepare_training_data(training_data)
                    if model_type == "xgboost":
                        r = train_xgboost_experiment(X, y, hyperparameters=hp)
                    elif model_type == "lstm":
                        r = train_lstm_experiment(X, y, hyperparameters=hp)
                    elif model_type in ("lightgbm", "randomforest"):
                        from .model import TrafficPredictionModel
                        m = TrafficPredictionModel(model_type=model_type)
                        metrics = m.train(X, y, hp if hp else None)
                        r = {
                            "model_type": model_type,
                            "metrics": {**metrics, "training_samples": m.training_samples, "test_samples": m.test_samples},
                            "params": hp,
                            "trained_at": datetime.now().isoformat(),
                        }
                    else:
                        logger.warning(f"Unknown model_type in compare: {model_type}")
                        continue
                results.append(r)
            except Exception as e:
                logger.error(f"Model {model_type} failed during comparison: {e}")

        if not results:
            raise HTTPException(status_code=500, detail="All models failed during comparison.")

        comparison = compare_models(results)

        entries = [
            ModelComparisonEntry(
                model_type=m["model_type"],
                mae=m["mae"],
                rmse=m["rmse"],
                r2=m["r2"],
                mape=m["mape"],
                training_samples=m.get("training_samples", 0),
                test_samples=m.get("test_samples", 0),
                trained_at=m.get("trained_at"),
            )
            for m in comparison["models"]
        ]

        return CompareModelsResponse(
            models=entries,
            best_model_by_mae=comparison["best_model_by_mae"],
            compared_at=comparison["compared_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Model comparison failed: {e}")
        raise HTTPException(status_code=500, detail=f"Model comparison failed: {str(e)}")


# ── Sprint 7.1.2 — Hyperparameter Tuning endpoints ──────────────────────────

@app.post("/models/tune", response_model=TuningResponse, tags=["Tuning"])
async def tune_hyperparameters(request: TuningRequest):
    """
    Run hyperparameter tuning (grid_search or optuna) for xgboost or lightgbm.
    Saves best params to ./models/best_params.json.
    """
    try:
        training_data = db.fetch_training_data(limit=request.data_limit)
        if len(training_data) < 20:
            raise HTTPException(status_code=422, detail="Insufficient training data (need ≥ 20 records).")

        X, y = preprocessor.prepare_training_data(training_data)

        method = request.method.lower()
        model_type = request.model_type.lower()

        if method == "grid_search":
            if model_type != "xgboost":
                raise HTTPException(status_code=400, detail="grid_search is only supported for 'xgboost'.")
            result = run_grid_search_xgboost(X, y, cv=request.cv_folds)
            return TuningResponse(**result, params_saved_to="./models/best_params.json")

        elif method == "optuna":
            if model_type == "xgboost":
                result = run_optuna_xgboost(X, y, n_trials=request.n_trials, cv=request.cv_folds)
            elif model_type == "lightgbm":
                result = run_optuna_lightgbm(X, y, n_trials=request.n_trials, cv=request.cv_folds)
            else:
                raise HTTPException(status_code=400, detail=f"Optuna not supported for '{model_type}'. Use 'xgboost' or 'lightgbm'.")
            return TuningResponse(**result, params_saved_to="./models/best_params.json")

        else:
            raise HTTPException(status_code=400, detail=f"Unknown method '{method}'. Use 'grid_search' or 'optuna'.")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Hyperparameter tuning failed: {e}")
        raise HTTPException(status_code=500, detail=f"Tuning failed: {str(e)}")


@app.get("/models/best-params", tags=["Tuning"])
async def get_best_params(key: str = None):
    """
    Retrieve stored best hyperparameters from ./models/best_params.json.
    Optionally filter by key (e.g., 'xgboost_optuna').
    """
    params = load_best_params(key)
    if not params:
        return {"status": "not_found", "message": "No best params saved yet. Run /models/tune first.", "data": {}}
    return {"status": "success", "data": params, "timestamp": datetime.now().isoformat()}


# ── Sprint 7.1.3 — Temporal Cross-Validation endpoints ──────────────────────

@app.post("/validation/run", response_model=CrossValidationResponse, tags=["Validation"])
async def run_cross_validation(request: CrossValidationRequest):
    """
    Run TimeSeriesSplit cross-validation and return per-fold + aggregated metrics.
    Results are persisted to ./models/cv_results.json.
    """
    try:
        training_data = db.fetch_training_data(limit=request.data_limit)
        if len(training_data) < request.n_splits * 5:
            raise HTTPException(
                status_code=422,
                detail=f"Insufficient data: need at least {request.n_splits * 5} samples for {request.n_splits} folds."
            )

        X, y = preprocessor.prepare_training_data(training_data)

        result = run_timeseries_cv(
            X, y,
            model_type=request.model_type,
            n_splits=request.n_splits,
            hyperparameters=request.hyperparameters,
        )

        folds = [FoldMetrics(**f) for f in result["folds"]]

        agg_raw = result["aggregated"]
        agg_metrics = AggregatedMetrics(
            mae=AggregatedMetric(**agg_raw["mae"]) if "mae" in agg_raw else None,
            rmse=AggregatedMetric(**agg_raw["rmse"]) if "rmse" in agg_raw else None,
            r2=AggregatedMetric(**agg_raw["r2"]) if "r2" in agg_raw else None,
            mape=AggregatedMetric(**agg_raw["mape"]) if "mape" in agg_raw else None,
            successful_folds=agg_raw.get("successful_folds", 0),
        )

        return CrossValidationResponse(
            model_type=result["model_type"],
            n_splits=result["n_splits"],
            folds=folds,
            aggregated=agg_metrics,
            total_samples=result["total_samples"],
            validated_at=result["validated_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cross-validation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Cross-validation failed: {str(e)}")


@app.get("/validation/results", tags=["Validation"])
async def get_validation_results():
    """
    Retrieve all stored cross-validation results from ./models/cv_results.json.
    """
    results = load_cv_results()
    if not results:
        return {
            "status": "not_found",
            "message": "No CV results saved yet. Run POST /validation/run first.",
            "data": {},
        }
    return {
        "status": "success",
        "count": len(results),
        "data": results,
        "timestamp": datetime.now().isoformat(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.ml_service_host,
        port=settings.ml_service_port,
        reload=settings.environment == "development"
    )
