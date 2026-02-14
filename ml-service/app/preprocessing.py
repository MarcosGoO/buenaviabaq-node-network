"""
Feature preprocessing and transformation
"""
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from typing import List, Dict, Any, Tuple
import logging

logger = logging.getLogger(__name__)


class FeaturePreprocessor:
    """Handles feature preprocessing for ML models"""

    # Feature order for model input (must be consistent)
    FEATURE_ORDER = [
        'hour_of_day',
        'day_of_week',
        'day_of_month',
        'month',
        'is_rush_hour',
        'is_weekend',
        'avg_speed_historical',
        'avg_congestion_level_encoded',
        'traffic_std_deviation',
        'temperature',
        'humidity',
        'wind_speed',
        'rain_probability',
        'weather_condition_encoded',
        'is_raining',
        'event_nearby',
        'event_type_encoded',
        'event_distance_km',
        'road_type_encoded',
        'lanes',
        'max_speed_kmh',
        'arroyo_nearby',
        'arroyo_risk_level_encoded',
        'arroyo_distance_km',
    ]

    def __init__(self):
        self.scaler = StandardScaler()
        self.is_fitted = False

    def prepare_features(self, data: List[Dict[str, Any]]) -> pd.DataFrame:
        """
        Convert raw feature data to pandas DataFrame

        Args:
            data: List of feature dictionaries from database

        Returns:
            DataFrame with features in correct order
        """
        df = pd.DataFrame(data)

        # Convert boolean columns to int
        bool_columns = ['is_rush_hour', 'is_weekend', 'is_raining',
                       'event_nearby', 'arroyo_nearby']
        for col in bool_columns:
            if col in df.columns:
                df[col] = df[col].astype(int)

        # Fill missing values
        df = self._fill_missing_values(df)

        # Ensure all features are present
        for feature in self.FEATURE_ORDER:
            if feature not in df.columns:
                df[feature] = 0

        # Select and order features
        df = df[self.FEATURE_ORDER]

        return df

    def _fill_missing_values(self, df: pd.DataFrame) -> pd.DataFrame:
        """Fill missing values with appropriate defaults"""

        # Numeric features: fill with median or 0
        numeric_fills = {
            'avg_speed_historical': df.get('avg_speed_historical', pd.Series([50])).median(),
            'avg_congestion_level_encoded': 0.33,  # moderate
            'traffic_std_deviation': 0,
            'temperature': 30,  # Barranquilla average
            'humidity': 75,
            'wind_speed': 15,
            'rain_probability': 20,
            'weather_condition_encoded': 1,  # Clouds (most common)
            'event_type_encoded': 0,
            'event_distance_km': 10,  # far away
            'road_type_encoded': 2,  # street (default)
            'lanes': 2,
            'max_speed_kmh': 60,
            'arroyo_risk_level_encoded': 0,
            'arroyo_distance_km': 5,
        }

        for col, fill_value in numeric_fills.items():
            if col in df.columns:
                df[col] = df[col].fillna(fill_value)

        return df

    def fit_scaler(self, X: pd.DataFrame) -> None:
        """Fit the scaler on training data"""
        self.scaler.fit(X)
        self.is_fitted = True
        logger.info("Feature scaler fitted on training data")

    def transform(self, X: pd.DataFrame) -> np.ndarray:
        """Transform features using fitted scaler"""
        if not self.is_fitted:
            logger.warning("Scaler not fitted, using raw features")
            return X.values

        return self.scaler.transform(X)

    def fit_transform(self, X: pd.DataFrame) -> np.ndarray:
        """Fit scaler and transform features"""
        self.fit_scaler(X)
        return self.transform(X)

    def prepare_training_data(
        self,
        data: List[Dict[str, Any]]
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Prepare features and targets for training

        Args:
            data: List of feature dictionaries with target values

        Returns:
            Tuple of (X, y) where X is feature matrix and y is target speeds
        """
        df = pd.DataFrame(data)

        # Extract target variable
        if 'target_speed_kmh' not in df.columns:
            raise ValueError("Training data must contain target_speed_kmh")

        y = df['target_speed_kmh'].values

        # Prepare features
        X_df = self.prepare_features(data)

        # Transform features
        X = self.fit_transform(X_df)

        logger.info(f"Prepared training data: X shape {X.shape}, y shape {y.shape}")

        return X, y

    def prepare_prediction_features(
        self,
        features_dict: Dict[str, Any]
    ) -> np.ndarray:
        """
        Prepare a single feature vector for prediction

        Args:
            features_dict: Dictionary with feature values

        Returns:
            Transformed feature array ready for prediction
        """
        # Convert to DataFrame
        df = self.prepare_features([features_dict])

        # Transform
        X = self.transform(df)

        return X

    @staticmethod
    def encode_congestion_level(speed_kmh: float, max_speed_kmh: int = 60) -> str:
        """
        Convert predicted speed to congestion level

        Args:
            speed_kmh: Predicted speed in km/h
            max_speed_kmh: Maximum speed for the road

        Returns:
            Congestion level: 'low', 'moderate', 'high', or 'severe'
        """
        if max_speed_kmh == 0:
            max_speed_kmh = 60

        speed_ratio = speed_kmh / max_speed_kmh

        if speed_ratio >= 0.7:
            return 'low'
        elif speed_ratio >= 0.5:
            return 'moderate'
        elif speed_ratio >= 0.3:
            return 'high'
        else:
            return 'severe'

    def get_feature_names(self) -> List[str]:
        """Get ordered list of feature names"""
        return self.FEATURE_ORDER.copy()


# Global preprocessor instance
preprocessor = FeaturePreprocessor()
