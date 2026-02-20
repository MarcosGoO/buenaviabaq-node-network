"""
Hyperparameter Tuning: Grid Search + Optuna (Bayesian optimization)
Sprint 7.1.2 - Hyperparameter Tuning
"""
import json
import logging
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
from datetime import datetime

from sklearn.model_selection import GridSearchCV, cross_val_score
from sklearn.metrics import mean_absolute_error, make_scorer

logger = logging.getLogger(__name__)

BEST_PARAMS_PATH = Path("./models/best_params.json")


# ─────────────────────────────────────────────
# Grid Search
# ─────────────────────────────────────────────

def run_grid_search_xgboost(
    X: np.ndarray,
    y: np.ndarray,
    cv: int = 3,
    random_state: int = 42,
) -> Dict[str, Any]:
    """
    Grid search over XGBoost hyperparameters.
    Keeps the grid small to run in reasonable time without GPU.
    """
    import xgboost as xgb

    param_grid = {
        "n_estimators": [100, 200],
        "max_depth": [4, 6],
        "learning_rate": [0.05, 0.1],
        "subsample": [0.8, 1.0],
    }

    base_model = xgb.XGBRegressor(
        random_state=random_state,
        tree_method="hist",
        n_jobs=-1,
        verbosity=0,
    )

    scorer = make_scorer(mean_absolute_error, greater_is_better=False)

    logger.info(
        f"Starting Grid Search over {_count_combinations(param_grid)} combinations "
        f"(cv={cv})…"
    )

    gs = GridSearchCV(
        base_model,
        param_grid,
        scoring=scorer,
        cv=cv,
        n_jobs=-1,
        refit=True,
        verbose=0,
    )
    gs.fit(X, y)

    best_params = gs.best_params_
    best_score = -gs.best_score_  # MAE (positive)

    logger.info(f"Grid Search done. Best MAE={best_score:.4f}, params={best_params}")

    result = {
        "method": "grid_search",
        "model_type": "xgboost",
        "best_params": best_params,
        "best_mae": round(best_score, 4),
        "cv_folds": cv,
        "n_combinations": _count_combinations(param_grid),
        "timestamp": datetime.now().isoformat(),
    }

    _save_best_params("xgboost_grid_search", result)
    return result


def _count_combinations(param_grid: Dict[str, Any]) -> int:
    total = 1
    for v in param_grid.values():
        total *= len(v)
    return total


# ─────────────────────────────────────────────
# Optuna Bayesian Search
# ─────────────────────────────────────────────

def run_optuna_xgboost(
    X: np.ndarray,
    y: np.ndarray,
    n_trials: int = 30,
    cv: int = 3,
    random_state: int = 42,
) -> Dict[str, Any]:
    """
    Bayesian hyperparameter search for XGBoost using Optuna.
    """
    try:
        import optuna  # type: ignore
    except ImportError:
        raise RuntimeError("optuna package is not installed.")

    import xgboost as xgb
    from sklearn.model_selection import cross_val_score

    optuna.logging.set_verbosity(optuna.logging.WARNING)

    def objective(trial: "optuna.Trial") -> float:  # type: ignore
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 100, 500),
            "max_depth": trial.suggest_int("max_depth", 3, 9),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
            "gamma": trial.suggest_float("gamma", 0.0, 1.0),
            "random_state": random_state,
            "tree_method": "hist",
            "n_jobs": -1,
            "verbosity": 0,
        }
        model = xgb.XGBRegressor(**params)
        scorer = make_scorer(mean_absolute_error, greater_is_better=False)
        scores = cross_val_score(model, X, y, cv=cv, scoring=scorer, n_jobs=1)
        return float(-scores.mean())  # Optuna minimizes → return positive MAE

    sampler = optuna.samplers.TPESampler(seed=random_state)
    study = optuna.create_study(direction="minimize", sampler=sampler)
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)

    best_params = study.best_params
    best_mae = study.best_value

    logger.info(
        f"Optuna done. Best MAE={best_mae:.4f} after {n_trials} trials. "
        f"Params={best_params}"
    )

    result = {
        "method": "optuna_bayesian",
        "model_type": "xgboost",
        "best_params": best_params,
        "best_mae": round(best_mae, 4),
        "n_trials": n_trials,
        "cv_folds": cv,
        "timestamp": datetime.now().isoformat(),
    }

    _save_best_params("xgboost_optuna", result)
    return result


def run_optuna_lightgbm(
    X: np.ndarray,
    y: np.ndarray,
    n_trials: int = 30,
    cv: int = 3,
    random_state: int = 42,
) -> Dict[str, Any]:
    """
    Bayesian hyperparameter search for LightGBM using Optuna.
    """
    try:
        import optuna  # type: ignore
    except ImportError:
        raise RuntimeError("optuna package is not installed.")

    import lightgbm as lgb

    optuna.logging.set_verbosity(optuna.logging.WARNING)

    def objective(trial: "optuna.Trial") -> float:  # type: ignore
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 100, 500),
            "max_depth": trial.suggest_int("max_depth", 3, 9),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
            "num_leaves": trial.suggest_int("num_leaves", 20, 150),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
            "min_child_samples": trial.suggest_int("min_child_samples", 5, 50),
            "random_state": random_state,
            "verbose": -1,
            "n_jobs": -1,
        }
        model = lgb.LGBMRegressor(**params)
        scorer = make_scorer(mean_absolute_error, greater_is_better=False)
        scores = cross_val_score(model, X, y, cv=cv, scoring=scorer, n_jobs=1)
        return float(-scores.mean())

    sampler = optuna.samplers.TPESampler(seed=random_state)
    study = optuna.create_study(direction="minimize", sampler=sampler)
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)

    best_params = study.best_params
    best_mae = study.best_value

    logger.info(
        f"Optuna LightGBM done. Best MAE={best_mae:.4f} after {n_trials} trials."
    )

    result = {
        "method": "optuna_bayesian",
        "model_type": "lightgbm",
        "best_params": best_params,
        "best_mae": round(best_mae, 4),
        "n_trials": n_trials,
        "cv_folds": cv,
        "timestamp": datetime.now().isoformat(),
    }

    _save_best_params("lightgbm_optuna", result)
    return result


# ─────────────────────────────────────────────
# Persistence helpers
# ─────────────────────────────────────────────

def _save_best_params(key: str, result: Dict[str, Any]) -> None:
    """Append / update best params in best_params.json."""
    BEST_PARAMS_PATH.parent.mkdir(parents=True, exist_ok=True)

    existing: Dict[str, Any] = {}
    if BEST_PARAMS_PATH.exists():
        try:
            existing = json.loads(BEST_PARAMS_PATH.read_text())
        except json.JSONDecodeError:
            existing = {}

    existing[key] = result
    BEST_PARAMS_PATH.write_text(json.dumps(existing, indent=2, default=str))
    logger.info(f"Best params saved → {BEST_PARAMS_PATH} (key={key})")


def load_best_params(key: Optional[str] = None) -> Dict[str, Any]:
    """Load best params from disk. If key given, return that specific entry."""
    if not BEST_PARAMS_PATH.exists():
        return {}
    data: Dict[str, Any] = json.loads(BEST_PARAMS_PATH.read_text())
    if key:
        return data.get(key, {})
    return data
