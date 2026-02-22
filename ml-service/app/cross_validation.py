"""
Temporal Cross-Validation using TimeSeriesSplit
"""
import logging
import numpy as np
import json
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

logger = logging.getLogger(__name__)

CV_RESULTS_PATH = Path("./models/cv_results.json")


def run_timeseries_cv(
    X: np.ndarray,
    y: np.ndarray,
    model_type: str = "xgboost",
    n_splits: int = 5,
    hyperparameters: Optional[Dict[str, Any]] = None,
    random_state: int = 42,
) -> Dict[str, Any]:
    """
    TimeSeriesSplit cross-validation for traffic prediction models.

    Args:
        X: Feature matrix (scaled, ordered chronologically)
        y: Target speeds
        model_type: One of 'xgboost', 'lightgbm', 'randomforest'
        n_splits: Number of CV folds (default 5)
        hyperparameters: Optional model params
        random_state: Reproducibility seed

    Returns:
        Dict with per-fold metrics and aggregated stats
    """
    tscv = TimeSeriesSplit(n_splits=n_splits)

    fold_results: List[Dict[str, Any]] = []

    for fold_idx, (train_idx, test_idx) in enumerate(tscv.split(X)):
        X_train, X_test = X[train_idx], X[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]

        model = _build_model(model_type, hyperparameters, random_state)

        try:
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            y_pred = np.maximum(y_pred, 0)

            fold_metrics = _compute_fold_metrics(y_test, y_pred)
            fold_metrics["fold"] = fold_idx + 1
            fold_metrics["train_size"] = int(len(X_train))
            fold_metrics["test_size"] = int(len(X_test))

            logger.info(
                f"Fold {fold_idx + 1}/{n_splits} — "
                f"MAE={fold_metrics['mae']:.4f}, "
                f"RMSE={fold_metrics['rmse']:.4f}, "
                f"R²={fold_metrics['r2']:.4f}"
            )
        except Exception as e:
            logger.error(f"Fold {fold_idx + 1} failed: {e}")
            fold_metrics = {
                "fold": fold_idx + 1,
                "error": str(e),
                "mae": None,
                "rmse": None,
                "r2": None,
                "mape": None,
                "train_size": int(len(X_train)),
                "test_size": int(len(X_test)),
            }

        fold_results.append(fold_metrics)

    # Aggregate only successful folds
    valid_folds = [f for f in fold_results if f.get("mae") is not None]
    aggregated = _aggregate_metrics(valid_folds)

    result = {
        "model_type": model_type,
        "n_splits": n_splits,
        "folds": fold_results,
        "aggregated": aggregated,
        "total_samples": int(len(X)),
        "validated_at": datetime.now().isoformat(),
    }

    _save_cv_results(model_type, result)
    return result


def _build_model(
    model_type: str,
    hyperparameters: Optional[Dict[str, Any]],
    random_state: int,
):
    """Instantiate a fresh model for each CV fold."""
    params = hyperparameters or {}

    if model_type == "xgboost":
        import xgboost as xgb

        default = {
            "n_estimators": 200,
            "max_depth": 6,
            "learning_rate": 0.05,
            "random_state": random_state,
            "tree_method": "hist",
            "verbosity": 0,
            "n_jobs": -1,
        }
        default.update(params)
        return xgb.XGBRegressor(**default)

    elif model_type == "lightgbm":
        import lightgbm as lgb

        default = {
            "n_estimators": 200,
            "max_depth": 6,
            "learning_rate": 0.05,
            "num_leaves": 31,
            "random_state": random_state,
            "verbose": -1,
            "n_jobs": -1,
        }
        default.update(params)
        return lgb.LGBMRegressor(**default)

    elif model_type == "randomforest":
        from sklearn.ensemble import RandomForestRegressor

        default = {
            "n_estimators": 100,
            "max_depth": 10,
            "random_state": random_state,
            "n_jobs": -1,
        }
        default.update(params)
        return RandomForestRegressor(**default)

    else:
        raise ValueError(
            f"Unsupported model type for CV: '{model_type}'. "
            "Choose from 'xgboost', 'lightgbm', 'randomforest'."
        )


def _compute_fold_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2 = float(r2_score(y_true, y_pred))
    mape = float(np.mean(np.abs((y_true - y_pred) / (np.abs(y_true) + 1e-10))) * 100)
    return {"mae": mae, "rmse": rmse, "r2": r2, "mape": mape}


def _aggregate_metrics(folds: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not folds:
        return {}

    metrics = ["mae", "rmse", "r2", "mape"]
    agg: Dict[str, Any] = {}
    for m in metrics:
        values = [f[m] for f in folds if f.get(m) is not None]
        if values:
            agg[m] = {
                "mean": round(float(np.mean(values)), 4),
                "std": round(float(np.std(values)), 4),
                "min": round(float(np.min(values)), 4),
                "max": round(float(np.max(values)), 4),
            }

    agg["successful_folds"] = len(folds)
    return agg


def _save_cv_results(model_type: str, result: Dict[str, Any]) -> None:
    CV_RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)

    existing: Dict[str, Any] = {}
    if CV_RESULTS_PATH.exists():
        try:
            existing = json.loads(CV_RESULTS_PATH.read_text())
        except json.JSONDecodeError:
            existing = {}

    key = f"{model_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    existing[key] = result
    CV_RESULTS_PATH.write_text(json.dumps(existing, indent=2, default=str))
    logger.info(f"CV results saved → {CV_RESULTS_PATH} (key={key})")


def load_cv_results() -> Dict[str, Any]:
    """Load all stored CV results from disk."""
    if not CV_RESULTS_PATH.exists():
        return {}
    return json.loads(CV_RESULTS_PATH.read_text())
