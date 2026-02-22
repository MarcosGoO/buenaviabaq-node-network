"""
tests: Model Experimentation, Hyperparameter Tuning, Cross-Validation
Run: pytest tests/test_sprint7.py -v
"""
import json
import importlib.util
import sys
import types
import numpy as np
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch


def _has_module(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


# ─────────────────────────────────────────────────────────────────────────────
# Helpers / fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def synthetic_data():
    """300 samples, 24 features, target ~ Uniform(30, 50)."""
    np.random.seed(42)
    n = 300
    X = np.random.randn(n, 24).astype(np.float32)
    y = (30 + 20 * np.random.rand(n)).astype(np.float32)
    return X, y


@pytest.fixture
def synthetic_training_records():
    """List of dicts simulating DB rows from ml_features."""
    np.random.seed(0)
    records = []
    for i in range(200):
        records.append({
            "road_id": (i % 6) + 1,
            "timestamp": f"2024-01-{(i % 28) + 1:02d}T{(i % 24):02d}:00:00",
            "hour_of_day": i % 24,
            "day_of_week": i % 7,
            "day_of_month": (i % 28) + 1,
            "month": (i % 12) + 1,
            "is_rush_hour": bool(i % 2),
            "is_weekend": bool(i % 7 >= 5),
            "avg_speed_historical": 40 + 10 * np.random.rand(),
            "avg_congestion_level_encoded": np.random.rand(),
            "traffic_std_deviation": 5 * np.random.rand(),
            "temperature": 30 + 5 * np.random.rand(),
            "humidity": 70 + 10 * np.random.rand(),
            "wind_speed": 15 + 5 * np.random.rand(),
            "rain_probability": 20 * np.random.rand(),
            "weather_condition_encoded": i % 5,
            "is_raining": bool(i % 5 == 0),
            "event_nearby": bool(i % 10 == 0),
            "event_type_encoded": i % 8,
            "event_distance_km": 2 + 5 * np.random.rand(),
            "zone_id": (i % 7) + 1,
            "road_type_encoded": i % 4,
            "lanes": (i % 3) + 1,
            "max_speed_kmh": [40, 60, 80][i % 3],
            "arroyo_nearby": bool(i % 8 == 0),
            "arroyo_risk_level_encoded": np.random.rand(),
            "arroyo_distance_km": 1 + 3 * np.random.rand(),
            "target_speed_kmh": 30 + 20 * np.random.rand(),
            "target_congestion_level": ["low", "moderate", "high", "severe"][i % 4],
        })
    return records


# ─────────────────────────────────────────────────────────────────────────────
# 7.1.3 — Cross-Validation (all sklearn, no extra deps)
# ─────────────────────────────────────────────────────────────────────────────

class TestCrossValidation:

    def test_randomforest_cv_basic(self, synthetic_data):
        from app.cross_validation import run_timeseries_cv

        X, y = synthetic_data
        result = run_timeseries_cv(X, y, model_type="randomforest", n_splits=3)

        assert result["model_type"] == "randomforest"
        assert result["n_splits"] == 3
        assert len(result["folds"]) == 3
        assert result["aggregated"]["successful_folds"] == 3
        assert result["aggregated"]["mae"]["mean"] > 0
        assert result["total_samples"] == len(X)

    def test_folds_respect_time_order(self, synthetic_data):
        """TimeSeriesSplit must never use future data for training."""
        from sklearn.model_selection import TimeSeriesSplit
        X, y = synthetic_data
        tscv = TimeSeriesSplit(n_splits=5)
        prev_test_end = 0
        for train_idx, test_idx in tscv.split(X):
            assert train_idx.max() < test_idx.min(), "Training leaks future data!"
            assert test_idx.min() >= prev_test_end
            prev_test_end = test_idx.max()

    def test_cv_persists_results(self, synthetic_data, tmp_path):
        from app.cross_validation import run_timeseries_cv, CV_RESULTS_PATH
        X, y = synthetic_data

        with patch("app.cross_validation.CV_RESULTS_PATH", tmp_path / "cv_results.json"):
            result = run_timeseries_cv(X, y, model_type="randomforest", n_splits=2)
            saved_path = tmp_path / "cv_results.json"
            assert saved_path.exists()
            data = json.loads(saved_path.read_text())
            assert len(data) == 1

    def test_compute_fold_metrics_perfect(self):
        from app.cross_validation import _compute_fold_metrics
        y_true = np.array([10.0, 20.0, 30.0])
        y_pred = np.array([10.0, 20.0, 30.0])
        m = _compute_fold_metrics(y_true, y_pred)
        assert m["mae"] == pytest.approx(0.0)
        assert m["r2"] == pytest.approx(1.0)
        assert m["mape"] == pytest.approx(0.0)

    def test_aggregate_metrics_correct(self):
        from app.cross_validation import _aggregate_metrics
        folds = [
            {"mae": 1.0, "rmse": 1.4, "r2": 0.9, "mape": 5.0},
            {"mae": 3.0, "rmse": 3.6, "r2": 0.7, "mape": 15.0},
        ]
        agg = _aggregate_metrics(folds)
        assert agg["mae"]["mean"] == pytest.approx(2.0)
        assert agg["mae"]["std"] == pytest.approx(1.0)
        assert agg["mae"]["min"] == pytest.approx(1.0)
        assert agg["mae"]["max"] == pytest.approx(3.0)
        assert agg["successful_folds"] == 2

    def test_unsupported_model_raises(self, synthetic_data):
        from app.cross_validation import run_timeseries_cv
        X, y = synthetic_data
        with pytest.raises(ValueError, match="Unsupported model type"):
            run_timeseries_cv(X, y, model_type="unknownmodel", n_splits=2)

    def test_load_cv_results_empty(self, tmp_path):
        from app.cross_validation import load_cv_results
        with patch("app.cross_validation.CV_RESULTS_PATH", tmp_path / "cv_results.json"):
            results = load_cv_results()
            assert results == {}


# ─────────────────────────────────────────────────────────────────────────────
# 7.1.2 — Hyperparameter Tuning helpers
# ─────────────────────────────────────────────────────────────────────────────

class TestHyperparameterTuning:

    def test_count_combinations(self):
        from app.hyperparameter_tuning import _count_combinations
        assert _count_combinations({"a": [1, 2], "b": [3, 4, 5]}) == 6
        assert _count_combinations({"x": [1]}) == 1
        assert _count_combinations({}) == 1

    def test_save_and_load_best_params(self, tmp_path):
        from app.hyperparameter_tuning import _save_best_params, load_best_params
        test_result = {
            "method": "optuna",
            "model_type": "xgboost",
            "best_params": {"n_estimators": 200, "max_depth": 5},
            "best_mae": 3.14,
            "cv_folds": 3,
            "timestamp": "2026-01-01T00:00:00",
        }
        with patch("app.hyperparameter_tuning.BEST_PARAMS_PATH", tmp_path / "best_params.json"):
            _save_best_params("xgboost_optuna", test_result)
            loaded = load_best_params("xgboost_optuna")
            assert loaded["best_mae"] == 3.14
            assert loaded["best_params"]["n_estimators"] == 200

    def test_load_best_params_missing_key(self, tmp_path):
        from app.hyperparameter_tuning import load_best_params
        with patch("app.hyperparameter_tuning.BEST_PARAMS_PATH", tmp_path / "bp.json"):
            result = load_best_params("nonexistent_key")
            assert result == {}

    def test_load_best_params_no_file(self, tmp_path):
        from app.hyperparameter_tuning import load_best_params
        with patch("app.hyperparameter_tuning.BEST_PARAMS_PATH", tmp_path / "nonexistent.json"):
            result = load_best_params()
            assert result == {}

    def test_save_multiple_keys(self, tmp_path):
        from app.hyperparameter_tuning import _save_best_params, load_best_params
        with patch("app.hyperparameter_tuning.BEST_PARAMS_PATH", tmp_path / "bp.json"):
            _save_best_params("key1", {"best_mae": 1.0, "timestamp": "t"})
            _save_best_params("key2", {"best_mae": 2.0, "timestamp": "t"})
            all_params = load_best_params()
            assert "key1" in all_params
            assert "key2" in all_params
            assert all_params["key1"]["best_mae"] == 1.0

    @pytest.mark.skipif(
        not _has_module("xgboost"), reason="xgboost not installed"
    )
    def test_grid_search_xgboost(self, synthetic_data):
        from app.hyperparameter_tuning import run_grid_search_xgboost
        X, y = synthetic_data
        with patch("app.hyperparameter_tuning.BEST_PARAMS_PATH", Path("/tmp/bp_test.json")):
            result = run_grid_search_xgboost(X, y, cv=2)
        assert result["method"] == "grid_search"
        assert result["model_type"] == "xgboost"
        assert result["best_mae"] > 0
        assert "n_estimators" in result["best_params"]

    @pytest.mark.skipif(
        not _has_module("optuna") or not _has_module("xgboost"),
        reason="optuna or xgboost not installed",
    )
    def test_optuna_xgboost(self, synthetic_data):
        from app.hyperparameter_tuning import run_optuna_xgboost
        X, y = synthetic_data
        with patch("app.hyperparameter_tuning.BEST_PARAMS_PATH", Path("/tmp/bp_optuna_test.json")):
            result = run_optuna_xgboost(X, y, n_trials=5, cv=2)
        assert result["method"] == "optuna_bayesian"
        assert result["n_trials"] == 5
        assert result["best_mae"] > 0


# ─────────────────────────────────────────────────────────────────────────────
# 7.1.1 — Model Experiments
# ─────────────────────────────────────────────────────────────────────────────

class TestMLExperiments:

    def test_compute_metrics_perfect(self):
        from app.ml_experiments import _compute_metrics
        y = np.array([10.0, 20.0, 30.0, 40.0])
        m = _compute_metrics(y, y)
        assert m["mae"] == pytest.approx(0.0)
        assert m["r2"] == pytest.approx(1.0)
        assert m["rmse"] == pytest.approx(0.0)
        assert m["mape"] == pytest.approx(0.0)

    def test_compute_metrics_known_values(self):
        from app.ml_experiments import _compute_metrics
        y_true = np.array([10.0, 20.0])
        y_pred = np.array([12.0, 18.0])
        m = _compute_metrics(y_true, y_pred)
        assert m["mae"] == pytest.approx(2.0)

    def test_compare_models_sorts_by_mae(self):
        from app.ml_experiments import compare_models
        results = [
            {"model_type": "model_a", "metrics": {"mae": 5.0, "rmse": 7.0, "r2": 0.7, "mape": 10.0, "training_samples": 100, "test_samples": 20}, "trained_at": "t"},
            {"model_type": "model_b", "metrics": {"mae": 2.0, "rmse": 3.0, "r2": 0.9, "mape": 5.0, "training_samples": 100, "test_samples": 20}, "trained_at": "t"},
            {"model_type": "model_c", "metrics": {"mae": 8.0, "rmse": 10.0, "r2": 0.5, "mape": 20.0, "training_samples": 100, "test_samples": 20}, "trained_at": "t"},
        ]
        comp = compare_models(results)
        assert comp["best_model_by_mae"] == "model_b"
        assert comp["models"][0]["model_type"] == "model_b"
        assert comp["models"][-1]["model_type"] == "model_c"

    def test_compare_models_empty(self):
        from app.ml_experiments import compare_models
        comp = compare_models([])
        assert comp["best_model_by_mae"] is None
        assert comp["models"] == []

    def test_lstm_experiment_basic(self, synthetic_data):
        """LSTM uses only PyTorch which IS available locally."""
        from app.ml_experiments import train_lstm_experiment
        X, y = synthetic_data
        r = train_lstm_experiment(
            X, y,
            hyperparameters={"hidden_size": 16, "num_layers": 1, "epochs": 3, "batch_size": 64},
        )
        assert r["model_type"] == "lstm"
        assert r["metrics"]["mae"] > 0
        assert r["metrics"]["training_samples"] + r["metrics"]["test_samples"] == len(X)
        assert r["model"] is not None

    def test_lstm_predictions_non_negative(self, synthetic_data):
        """Predicted speeds should never be negative."""
        from app.ml_experiments import train_lstm_experiment
        X, y = synthetic_data
        r = train_lstm_experiment(
            X, y,
            hyperparameters={"hidden_size": 16, "num_layers": 1, "epochs": 2, "batch_size": 64},
        )
        model = r["model"]
        preds = model.predict(X[:10])
        assert np.all(preds >= 0), "Some predictions are negative!"

    @pytest.mark.skipif(
        not _has_module("xgboost"), reason="xgboost not installed"
    )
    def test_xgboost_experiment(self, synthetic_data):
        from app.ml_experiments import train_xgboost_experiment
        X, y = synthetic_data
        r = train_xgboost_experiment(X, y, hyperparameters={"n_estimators": 50})
        assert r["model_type"] == "xgboost"
        assert r["metrics"]["r2"] > -1  # Reasonable model
        assert r["metrics"]["training_samples"] > 0

    @pytest.mark.skipif(
        not _has_module("prophet"), reason="prophet not installed"
    )
    def test_prophet_experiment(self, synthetic_training_records):
        from app.ml_experiments import train_prophet_experiment
        r = train_prophet_experiment(synthetic_training_records)
        assert r["model_type"] == "prophet"
        assert r["metrics"]["mae"] > 0


# ─────────────────────────────────────────────────────────────────────────────
# 7.1.3 — Schemas validation
# ─────────────────────────────────────────────────────────────────────────────

class TestSchemas:

    def test_experiment_request_defaults(self):
        from app.schemas import ExperimentRequest
        req = ExperimentRequest()
        assert req.model_type == "xgboost"
        assert req.hyperparameters is None
        assert req.data_limit is None

    def test_tuning_request_bounds(self):
        from app.schemas import TuningRequest
        import pydantic
        with pytest.raises(pydantic.ValidationError):
            TuningRequest(n_trials=4)  # ge=5 constraint
        with pytest.raises(pydantic.ValidationError):
            TuningRequest(n_trials=201)  # le=200 constraint

    def test_fold_metrics_optional_error(self):
        from app.schemas import FoldMetrics
        fm = FoldMetrics(fold=1, train_size=100, test_size=20, error="Something failed")
        assert fm.mae is None
        assert fm.error == "Something failed"

    def test_aggregated_metric_all_fields(self):
        from app.schemas import AggregatedMetric
        am = AggregatedMetric(mean=1.5, std=0.3, min=1.0, max=2.0)
        assert am.mean == 1.5
        assert am.std == 0.3

    def test_cross_validation_response_roundtrip(self):
        from app.schemas import (
            CrossValidationResponse, FoldMetrics, AggregatedMetrics, AggregatedMetric
        )
        resp = CrossValidationResponse(
            model_type="xgboost",
            n_splits=3,
            folds=[FoldMetrics(fold=1, mae=1.0, rmse=1.4, r2=0.9, mape=5.0, train_size=200, test_size=50)],
            aggregated=AggregatedMetrics(
                mae=AggregatedMetric(mean=1.0, std=0.0, min=1.0, max=1.0),
                successful_folds=1,
            ),
            total_samples=300,
            validated_at="2026-02-20T12:00:00",
        )
        data = resp.model_dump()
        assert data["model_type"] == "xgboost"
        assert data["aggregated"]["mae"]["mean"] == 1.0


