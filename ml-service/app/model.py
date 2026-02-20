"""
Machine Learning model training and prediction
"""
import numpy as np
import joblib
import logging
from pathlib import Path
from typing import Optional, Dict, Any, Tuple
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.ensemble import RandomForestRegressor
import lightgbm as lgb
import xgboost as xgb
import mlflow
import mlflow.sklearn

from .config import settings
from .preprocessing import preprocessor
from .database import db

logger = logging.getLogger(__name__)


class TrafficPredictionModel:
    """Traffic speed prediction model"""

    def __init__(self, model_type: str = "lightgbm"):
        self.model_type = model_type
        self.model = None
        self.metrics = None
        self.trained_at = None
        self.training_samples = 0
        self.test_samples = 0
        self.model_version = "1.0.0"

    def _create_model(self, hyperparameters: Optional[Dict[str, Any]] = None):
        """Create model based on model_type"""
        params = hyperparameters or {}

        if self.model_type == "lightgbm":
            default_params = {
                'n_estimators': settings.n_estimators,
                'max_depth': settings.max_depth,
                'learning_rate': 0.1,
                'num_leaves': 31,
                'random_state': settings.random_state,
                'verbose': -1
            }
            default_params.update(params)
            self.model = lgb.LGBMRegressor(**default_params)

        elif self.model_type == "randomforest":
            default_params = {
                'n_estimators': settings.n_estimators,
                'max_depth': settings.max_depth,
                'random_state': settings.random_state,
                'n_jobs': -1
            }
            default_params.update(params)
            self.model = RandomForestRegressor(**default_params)

        elif self.model_type == "xgboost":
            default_params = {
                'n_estimators': settings.n_estimators,
                'max_depth': settings.max_depth,
                'learning_rate': 0.1,
                'random_state': settings.random_state,
                'tree_method': 'hist'
            }
            default_params.update(params)
            self.model = xgb.XGBRegressor(**default_params)

        elif self.model_type == 'prophet':
            # Prophet does not use 'default_params' in the same way as other models
            # It expects its own specific parameters
            self.model = Prophet(**params)
            default_params = params # For logging purposes
        else:
            raise ValueError(f"Unsupported model type: {self.model_type}")

        logger.info(f"Created {self.model_type} model with params: {default_params}")

    def train(
        self,
        X: np.ndarray,
        y: np.ndarray,
        hyperparameters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, float]:
        """
        Train the model

        Args:
            X: Feature matrix
            y: Target values (speeds)
            hyperparameters: Optional model hyperparameters

        Returns:
            Dictionary with evaluation metrics
        """
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size=settings.train_test_split,
            random_state=settings.random_state
        )

        self.training_samples = len(X_train)
        self.test_samples = len(X_test)

        logger.info(f"Training with {self.training_samples} samples, "
                   f"testing with {self.test_samples} samples")

        # Create and train model
        self._create_model(hyperparameters)
        
        # Train model
        if self.model_type == 'prophet':
            # Prophet requires a dataframe with 'ds' and 'y' columns
            # For this simple integration, we'll use a dummy datetime column for training
            # In a real scenario, 'ds' would come from actual timestamp features in X
            # For now, we'll train Prophet on the full dataset (X, y) as it's not a typical
            # sklearn-style train/test split model for its internal validation.
            # We'll then use the last part of the data for evaluation.
            
            # Create a DataFrame for Prophet
            # Assuming X has a timestamp column or we can synthesize one for demonstration
            # For a proper Prophet integration, X should contain the 'ds' column.
            # Here, we'll create a dummy 'ds' for the entire dataset for simplicity.
            # A more robust solution would involve extracting 'ds' from X if available.
            
            # For demonstration, let's assume the last column of X_train is a timestamp or index
            # If X is purely features, we need to generate a time series index.
            # This is a placeholder and needs proper timestamp handling in a real application.
            
            # For now, let's use the full X, y for Prophet training and then predict on a future period
            # or simulate a test set prediction.
            
            # To align with the existing evaluation structure, we'll train Prophet on X_train, y_train
            # and then predict on X_test. This requires X_test to also have 'ds' column.
            # Since X is np.ndarray, we need to convert it to pd.DataFrame with 'ds' and 'y'.
            
            # This is a simplified approach for the requested change.
            # A proper Prophet integration would involve a different data preparation step
            # where 'ds' (datetime) and 'y' (target) are explicitly provided.
            
            # Let's assume X_train and X_test are already prepared with a 'ds' column
            # or we can generate one. For this example, we'll generate a dummy 'ds'.
            
            # Create DataFrames for Prophet
            # This part is highly dependent on how 'ds' (timestamp) is derived from X.
            # For a generic numpy array X, we'll create a dummy time index.
            # In a real application, you'd extract the actual timestamp from your features.
            
            # For training:
            df_train = pd.DataFrame({'y': y_train})
            # Generate a dummy 'ds' column. This needs to be replaced with actual timestamps.
            df_train['ds'] = pd.to_datetime(pd.date_range(start='2020-01-01', periods=len(df_train), freq='h'))
            
            self.model.fit(df_train)
            
            # For prediction on test set:
            df_test = pd.DataFrame({'y': y_test}) # y_test is not used by predict, but kept for consistency
            df_test['ds'] = pd.to_datetime(pd.date_range(start=df_train['ds'].iloc[-1] + pd.Timedelta(hours=1), periods=len(df_test), freq='h'))
            
            forecast = self.model.predict(df_test)
            y_pred = forecast['yhat'].values
            
        else:
            self.model.fit(X_train, y_train)
            
            # Evaluate on test set
            y_pred = self.model.predict(X_test)

        mae = mean_absolute_error(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        r2 = r2_score(y_test, y_pred)

        # Calculate MAPE (Mean Absolute Percentage Error)
        mape = np.mean(np.abs((y_test - y_pred) / (y_test + 1e-10))) * 100

        self.metrics = {
            'mae': float(mae),
            'rmse': float(rmse),
            'r2': float(r2),
            'mape': float(mape)
        }

        self.trained_at = datetime.now()

        # MLflow Tracking
        mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
        mlflow.set_experiment(settings.mlflow_experiment_name)
        with mlflow.start_run(run_name=f"{self.model_type}_training"):
            mlflow.log_params(hyperparameters or {})
            mlflow.log_metrics(self.metrics)
            mlflow.sklearn.log_model(self.model, "model")

        logger.info(f"Model trained successfully. Metrics: {self.metrics}")

        return self.metrics

    def predict(self, X: np.ndarray) -> np.ndarray:
        """
        Make predictions

        Args:
            X: Feature matrix

        Returns:
            Predicted speeds
        """
        if self.model is None:
            raise ValueError("Model not trained or loaded")

        predictions = self.model.predict(X)

        # Ensure predictions are positive
        predictions = np.maximum(predictions, 0)

        return predictions

    def get_feature_importance(self) -> Dict[str, float]:
        """Get feature importance scores"""
        if self.model is None:
            return {}

        feature_names = preprocessor.get_feature_names()

        if hasattr(self.model, 'feature_importances_'):
            importances = self.model.feature_importances_
            return dict(zip(feature_names, importances.tolist()))

        return {}

    def get_explanation(self, X: np.ndarray) -> Dict[str, float]:
        """Get SHAP explanations for a single prediction"""
        if self.model is None:
            return {}
            
        try:
            import shap
            # For tree models
            explainer = shap.TreeExplainer(self.model)
            shap_values = explainer.shap_values(X)
            
            feature_names = preprocessor.get_feature_names()
            # If multiple samples, take the first one
            shap_array = shap_values[0] if len(np.array(shap_values).shape) > 1 else shap_values
            
            return dict(zip(feature_names, np.array(shap_array).tolist()))
        except Exception as e:
            logger.error(f"SHAP explanation failed: {e}")
            return {}

    def save(self, model_path: Optional[str] = None):
        """Save model to disk"""
        if self.model is None:
            raise ValueError("No model to save")

        path = model_path or settings.model_path
        Path(path).parent.mkdir(parents=True, exist_ok=True)

        model_data = {
            'model': self.model,
            'model_type': self.model_type,
            'model_version': self.model_version,
            'metrics': self.metrics,
            'trained_at': self.trained_at,
            'training_samples': self.training_samples,
            'test_samples': self.test_samples
        }

        joblib.dump(model_data, path)
        logger.info(f"Model saved to {path}")

        # Save scaler separately
        scaler_path = settings.feature_scaler_path
        Path(scaler_path).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(preprocessor.scaler, scaler_path)
        logger.info(f"Scaler saved to {scaler_path}")

    def load(self, model_path: Optional[str] = None):
        """Load model from disk"""
        path = model_path or settings.model_path

        if not Path(path).exists():
            raise FileNotFoundError(f"Model not found at {path}")

        model_data = joblib.load(path)

        self.model = model_data['model']
        self.model_type = model_data.get('model_type', 'unknown')
        self.model_version = model_data.get('model_version', '1.0.0')
        self.metrics = model_data.get('metrics')
        self.trained_at = model_data.get('trained_at')
        self.training_samples = model_data.get('training_samples', 0)
        self.test_samples = model_data.get('test_samples', 0)

        logger.info(f"Model loaded from {path}")

        # Load scaler
        scaler_path = settings.feature_scaler_path
        if Path(scaler_path).exists():
            preprocessor.scaler = joblib.load(scaler_path)
            preprocessor.is_fitted = True
            logger.info(f"Scaler loaded from {scaler_path}")

    def is_trained(self) -> bool:
        """Check if model is trained"""
        return self.model is not None


class ModelManager:
    """Manages model lifecycle"""

    def __init__(self):
        self.current_model: Optional[TrafficPredictionModel] = None

    def train_new_model(
        self,
        model_type: Optional[str] = None,
        hyperparameters: Optional[Dict[str, Any]] = None,
        data_limit: Optional[int] = None
    ) -> Tuple[TrafficPredictionModel, Dict[str, float]]:
        """
        Train a new model from scratch

        Args:
            model_type: Type of model to train
            hyperparameters: Model hyperparameters
            data_limit: Maximum number of training samples

        Returns:
            Tuple of (trained model, metrics)
        """
        # Fetch training data
        logger.info("Fetching training data from database...")
        training_data = db.fetch_training_data(limit=data_limit)

        if len(training_data) < 10:
            raise ValueError(f"Insufficient training data: {len(training_data)} samples")

        logger.info(f"Fetched {len(training_data)} training samples")

        # Prepare data
        X, y = preprocessor.prepare_training_data(training_data)

        # Create and train model
        model_type = model_type or settings.model_type
        model = TrafficPredictionModel(model_type=model_type)
        metrics = model.train(X, y, hyperparameters)

        # Save model
        model.save()

        # Update current model
        self.current_model = model

        return model, metrics

    def load_model(self, model_path: Optional[str] = None) -> TrafficPredictionModel:
        """Load existing model"""
        model = TrafficPredictionModel()
        model.load(model_path)
        self.current_model = model
        return model

    def get_model(self) -> Optional[TrafficPredictionModel]:
        """Get current model"""
        return self.current_model

    def predict(self, features: Dict[str, Any], explain: bool = False) -> Tuple[float, str, Optional[Dict[str, float]]]:
        """
        Make prediction using current model

        Args:
            features: Feature dictionary
            explain: Whether to return SHAP explanations

        Returns:
            Tuple of (predicted_speed, congestion_level, explanation)
        """
        if not self.current_model:
            raise ValueError("No model loaded")

        # Prepare features
        X = preprocessor.prepare_prediction_features(features)

        # Predict
        speed_pred = float(self.current_model.predict(X)[0])

        # Convert to congestion level
        max_speed = features.get('max_speed_kmh', 60)
        congestion_level = preprocessor.encode_congestion_level(speed_pred, max_speed)

        explanation = None
        if explain:
            explanation = self.current_model.get_explanation(X)

        return speed_pred, congestion_level, explanation


# Global model manager instance
model_manager = ModelManager()
