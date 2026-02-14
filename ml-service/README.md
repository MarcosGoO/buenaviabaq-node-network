# VíaBaq ML Service

Machine Learning microservice for traffic prediction in Barranquilla.

## Features

- **Traffic Speed Prediction** using LightGBM, RandomForest, or XGBoost
- **RESTful API** built with FastAPI
- **Feature Engineering** with automated preprocessing
- **Model Management** with training and versioning
- **Docker Support** for easy deployment

## Quick Start

### Local Development

1. **Install dependencies:**
```bash
cd ml-service
pip install -r requirements.txt
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. **Start the service:**
```bash
python -m uvicorn app.main:app --reload --port 8000
```

4. **Access API docs:**
Open http://localhost:8000/docs

### Using Docker

```bash
docker build -t viabaq-ml-service .
docker run -p 8000:8000 --env-file .env viabaq-ml-service
```

## API Endpoints

### General

- `GET /` - Service information
- `GET /health` - Health check
- `GET /model/info` - Current model information

### Prediction

- `POST /predict` - Single prediction
- `POST /predict/batch` - Batch predictions

### Training

- `POST /train` - Train a new model
- `GET /features/stats` - Training data statistics

## Model Training

### Train a model via API:

```bash
curl -X POST "http://localhost:8000/train" \
  -H "Content-Type: application/json" \
  -d '{
    "model_type": "lightgbm",
    "force_retrain": true
  }'
```

### Available model types:
- `lightgbm` (default, recommended)
- `randomforest`
- `xgboost`

## Making Predictions

```bash
curl -X POST "http://localhost:8000/predict" \
  -H "Content-Type: application/json" \
  -d '{
    "features": {
      "road_id": 1,
      "hour_of_day": 17,
      "day_of_week": 5,
      "day_of_month": 14,
      "month": 2,
      "is_rush_hour": true,
      "is_weekend": false,
      "temperature": 32,
      "humidity": 75,
      "wind_speed": 20,
      "rain_probability": 30,
      "weather_condition_encoded": 1,
      "is_raining": false,
      "event_nearby": false,
      "arroyo_nearby": false
    }
  }'
```

## Project Structure

```
ml-service/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration management
│   ├── database.py          # Database connection
│   ├── model.py             # ML model training/prediction
│   ├── preprocessing.py     # Feature preprocessing
│   └── schemas.py           # Pydantic schemas
├── models/                  # Saved models (generated)
├── data/                    # Training data cache (optional)
├── tests/                   # Unit tests
├── requirements.txt         # Python dependencies
├── Dockerfile              # Docker configuration
└── README.md
```

## Model Metrics

The service evaluates models using:
- **MAE** (Mean Absolute Error)
- **RMSE** (Root Mean Squared Error)
- **R²** (R-squared)
- **MAPE** (Mean Absolute Percentage Error)

## Development

### Run tests:
```bash
pytest tests/
```

### Code formatting:
```bash
black app/
ruff check app/
```

## Environment Variables

See `.env.example` for all configuration options.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `MODEL_TYPE` - Default model type (lightgbm, randomforest, xgboost)
- `ML_SERVICE_PORT` - Service port (default: 8000)

## Integration with Node.js Backend

The ML service is designed to work with the Node.js backend (`server/`).

The Node.js backend will:
1. Extract features using the Feature Store
2. Send features to this ML service via HTTP
3. Receive predictions
4. Cache predictions with 15-minute TTL

## License

MIT

## Author

Marcos GoO