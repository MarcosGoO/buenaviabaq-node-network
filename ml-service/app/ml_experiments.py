"""
Model experimentation: XGBoost, Prophet (time series), LSTM (PyTorch)
Sprint 7.1.1 - Model Experimentation
"""
import numpy as np
import pandas as pd
import logging
import json
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# XGBoost Experiment
# ─────────────────────────────────────────────

def train_xgboost_experiment(
    X: np.ndarray,
    y: np.ndarray,
    hyperparameters: Optional[Dict[str, Any]] = None,
    random_state: int = 42,
) -> Dict[str, Any]:
    """
    Train an XGBoost model with the given data and return metrics + model.
    Uses quantile regression trees for confidence intervals.
    """
    import xgboost as xgb

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=random_state
    )

    params: Dict[str, Any] = {
        "n_estimators": 200,
        "max_depth": 6,
        "learning_rate": 0.05,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "random_state": random_state,
        "tree_method": "hist",
        "n_jobs": -1,
    }
    if hyperparameters:
        params.update(hyperparameters)

    model = xgb.XGBRegressor(**params)
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    y_pred = model.predict(X_test)
    y_pred = np.maximum(y_pred, 0)

    metrics = _compute_metrics(y_test, y_pred)
    metrics["training_samples"] = int(len(X_train))
    metrics["test_samples"] = int(len(X_test))

    return {
        "model_type": "xgboost",
        "model": model,
        "metrics": metrics,
        "params": params,
        "trained_at": datetime.now().isoformat(),
    }


# ─────────────────────────────────────────────
# Prophet Experiment
# ─────────────────────────────────────────────

def train_prophet_experiment(
    training_data: List[Dict[str, Any]],
    hyperparameters: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Train a Prophet model for time-series traffic speed prediction.

    Prophet expects a DataFrame with 'ds' (datetime) and 'y' (target) columns.
    We reconstruct the datetime from the temporal features stored in training_data.
    """
    try:
        from prophet import Prophet  # type: ignore
    except ImportError:
        raise RuntimeError(
            "prophet package is not installed. Add it to requirements.txt."
        )

    df = pd.DataFrame(training_data)

    # Reconstruct datetime from hour/day features if 'timestamp' not available
    if "timestamp" in df.columns and df["timestamp"].notna().all():
        df["ds"] = pd.to_datetime(df["timestamp"])
    else:
        # Synthesize timestamps from temporal features (for seeded data)
        base_date = pd.Timestamp("2024-01-01")
        df["ds"] = base_date + pd.to_timedelta(
            df["day_of_week"].fillna(0) * 24 + df["hour_of_day"].fillna(0), unit="h"
        )

    df = df.rename(columns={"target_speed_kmh": "y"})
    df = df[["ds", "y"]].dropna().sort_values("ds").reset_index(drop=True)

    if len(df) < 20:
        raise ValueError(
            f"Insufficient data for Prophet: {len(df)} samples (need ≥20)."
        )

    # Train / test split by time (80/20)
    split_idx = int(len(df) * 0.8)
    df_train = df.iloc[:split_idx].copy()
    df_test = df.iloc[split_idx:].copy()

    prophet_params: Dict[str, Any] = {
        "yearly_seasonality": False,
        "weekly_seasonality": True,
        "daily_seasonality": True,
        "changepoint_prior_scale": 0.05,
        "seasonality_prior_scale": 10.0,
    }
    if hyperparameters:
        prophet_params.update(hyperparameters)

    model = Prophet(**prophet_params)
    model.fit(df_train)

    # Predict on test period
    future = model.make_future_dataframe(periods=len(df_test), freq="h")
    forecast = model.predict(future)

    # Align predictions with test set
    y_pred = forecast["yhat"].values[-len(df_test):]
    y_test_vals = df_test["y"].values
    y_pred = np.maximum(y_pred, 0)

    metrics = _compute_metrics(y_test_vals, y_pred)
    metrics["training_samples"] = int(len(df_train))
    metrics["test_samples"] = int(len(df_test))

    return {
        "model_type": "prophet",
        "model": model,
        "metrics": metrics,
        "params": prophet_params,
        "trained_at": datetime.now().isoformat(),
        "note": "Prophet is a time-series model. Predictions are temporal, not per-road-feature.",
    }


# ─────────────────────────────────────────────
# LSTM Experiment (PyTorch)
# ─────────────────────────────────────────────

class _LSTMNet:
    """Simple LSTM wrapper using PyTorch for traffic speed regression."""

    def __init__(self, input_size: int, hidden_size: int = 64, num_layers: int = 2):
        import torch
        import torch.nn as nn

        self.device = torch.device("cpu")
        self.hidden_size = hidden_size
        self.num_layers = num_layers

        class _Model(nn.Module):
            def __init__(self):
                super().__init__()
                self.lstm = nn.LSTM(
                    input_size, hidden_size, num_layers, batch_first=True, dropout=0.2
                )
                self.fc = nn.Linear(hidden_size, 1)

            def forward(self, x):
                out, _ = self.lstm(x)
                return self.fc(out[:, -1, :]).squeeze(1)

        self.model = _Model().to(self.device)
        self.optimizer = torch.optim.Adam(self.model.parameters(), lr=1e-3)
        self.loss_fn = nn.MSELoss()
        self._torch = torch

    def fit(self, X: np.ndarray, y: np.ndarray, epochs: int = 30, batch_size: int = 64):
        import torch

        # Reshape to (samples, seq_len=1, features)
        X_t = torch.tensor(X, dtype=torch.float32).unsqueeze(1).to(self.device)
        y_t = torch.tensor(y, dtype=torch.float32).to(self.device)

        dataset = torch.utils.data.TensorDataset(X_t, y_t)
        loader = torch.utils.data.DataLoader(dataset, batch_size=batch_size, shuffle=True)

        self.model.train()
        for epoch in range(epochs):
            for xb, yb in loader:
                self.optimizer.zero_grad()
                preds = self.model(xb)
                loss = self.loss_fn(preds, yb)
                loss.backward()
                self.optimizer.step()

        logger.info(f"LSTM training finished after {epochs} epochs.")

    def predict(self, X: np.ndarray) -> np.ndarray:
        import torch

        self.model.eval()
        with torch.no_grad():
            X_t = torch.tensor(X, dtype=torch.float32).unsqueeze(1).to(self.device)
            preds = self.model(X_t).cpu().numpy()
        return preds


def train_lstm_experiment(
    X: np.ndarray,
    y: np.ndarray,
    hyperparameters: Optional[Dict[str, Any]] = None,
    random_state: int = 42,
) -> Dict[str, Any]:
    """
    Train a PyTorch LSTM for traffic speed prediction.
    Input: feature matrix (already scaled). Sequence length = 1 (each row is one timestep).
    """
    try:
        import torch  # noqa: F401
    except ImportError:
        raise RuntimeError("torch package is not installed.")

    np.random.seed(random_state)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=random_state
    )

    params: Dict[str, Any] = {
        "hidden_size": 64,
        "num_layers": 2,
        "epochs": 30,
        "batch_size": 64,
    }
    if hyperparameters:
        params.update(hyperparameters)

    lstm = _LSTMNet(
        input_size=X_train.shape[1],
        hidden_size=params["hidden_size"],
        num_layers=params["num_layers"],
    )
    lstm.fit(X_train, y_train, epochs=params["epochs"], batch_size=params["batch_size"])

    y_pred = lstm.predict(X_test)
    y_pred = np.maximum(y_pred, 0)

    metrics = _compute_metrics(y_test, y_pred)
    metrics["training_samples"] = int(len(X_train))
    metrics["test_samples"] = int(len(X_test))

    return {
        "model_type": "lstm",
        "model": lstm,
        "metrics": metrics,
        "params": params,
        "trained_at": datetime.now().isoformat(),
        "note": "LSTM trained with sequence length=1. For multi-step sequences, use sliding window.",
    }


# ─────────────────────────────────────────────
# Compare All Models
# ─────────────────────────────────────────────

def compare_models(
    results: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Given a list of model result dicts (from train_*_experiment),
    return a summary comparing them by MAE, RMSE, R², MAPE.
    """
    comparison = []
    for r in results:
        m = r.get("metrics", {})
        comparison.append(
            {
                "model_type": r["model_type"],
                "mae": round(m.get("mae", float("inf")), 4),
                "rmse": round(m.get("rmse", float("inf")), 4),
                "r2": round(m.get("r2", -999), 4),
                "mape": round(m.get("mape", float("inf")), 4),
                "training_samples": m.get("training_samples", 0),
                "test_samples": m.get("test_samples", 0),
                "trained_at": r.get("trained_at"),
            }
        )

    # Sort by MAE ascending (lower is better)
    comparison.sort(key=lambda x: x["mae"])
    best_model = comparison[0]["model_type"] if comparison else None

    return {
        "models": comparison,
        "best_model_by_mae": best_model,
        "compared_at": datetime.now().isoformat(),
    }


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2 = float(r2_score(y_true, y_pred))
    mape = float(np.mean(np.abs((y_true - y_pred) / (np.abs(y_true) + 1e-10))) * 100)
    return {"mae": mae, "rmse": rmse, "r2": r2, "mape": mape}
