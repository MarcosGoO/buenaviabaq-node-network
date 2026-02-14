"""
Database connection and utilities
"""
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import List, Dict, Any, Optional
import logging
from .config import settings

logger = logging.getLogger(__name__)


class Database:
    """Database connection manager"""

    def __init__(self):
        self.connection = None

    def connect(self):
        """Establish database connection"""
        try:
            self.connection = psycopg2.connect(
                settings.database_url,
                cursor_factory=RealDictCursor
            )
            logger.info("Database connection established")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise

    def disconnect(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()
            logger.info("Database connection closed")

    def execute_query(self, query: str, params: Optional[tuple] = None) -> List[Dict[str, Any]]:
        """Execute a SELECT query and return results"""
        if not self.connection:
            self.connect()

        try:
            with self.connection.cursor() as cursor:
                cursor.execute(query, params)
                results = cursor.fetchall()
                return [dict(row) for row in results]
        except Exception as e:
            logger.error(f"Query execution failed: {e}")
            raise

    def fetch_training_data(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Fetch training data from ml_features table
        Only fetches records with labeled target values
        """
        query = """
            SELECT
                road_id,
                timestamp,
                hour_of_day,
                day_of_week,
                day_of_month,
                month,
                is_rush_hour,
                is_weekend,
                avg_speed_historical,
                avg_congestion_level_encoded,
                traffic_std_deviation,
                temperature,
                humidity,
                wind_speed,
                rain_probability,
                weather_condition_encoded,
                is_raining,
                event_nearby,
                event_type_encoded,
                event_distance_km,
                zone_id,
                road_type_encoded,
                lanes,
                max_speed_kmh,
                arroyo_nearby,
                arroyo_risk_level_encoded,
                arroyo_distance_km,
                target_speed_kmh,
                target_congestion_level
            FROM ml_features
            WHERE target_speed_kmh IS NOT NULL
            ORDER BY timestamp DESC
        """

        if limit:
            query += f" LIMIT {limit}"

        return self.execute_query(query)

    def get_feature_stats(self) -> Dict[str, Any]:
        """Get statistics about the feature store"""
        query = """
            SELECT
                COUNT(*) as total_records,
                COUNT(DISTINCT road_id) as unique_roads,
                MIN(timestamp) as earliest_record,
                MAX(timestamp) as latest_record,
                COUNT(*) FILTER (WHERE target_speed_kmh IS NOT NULL) as labeled_records,
                AVG(target_speed_kmh) as avg_speed
            FROM ml_features
        """

        results = self.execute_query(query)
        return results[0] if results else {}


# Global database instance
db = Database()
