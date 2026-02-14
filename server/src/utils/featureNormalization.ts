/**
 * Feature Normalization Utilities
 *
 * Provides functions to normalize and denormalize features for ML models
 * Uses min-max normalization to scale features to [0, 1] range
 */

export interface FeatureRange {
  min: number;
  max: number;
}

export interface NormalizationConfig {
  hour_of_day: FeatureRange;
  day_of_week: FeatureRange;
  day_of_month: FeatureRange;
  month: FeatureRange;
  temperature: FeatureRange;
  humidity: FeatureRange;
  wind_speed: FeatureRange;
  rain_probability: FeatureRange;
  speed_kmh: FeatureRange;
  lanes: FeatureRange;
  max_speed_kmh: FeatureRange;
  distance_km: FeatureRange;
}

/**
 * Default normalization ranges based on Barranquilla traffic data
 */
export const DEFAULT_NORMALIZATION_CONFIG: NormalizationConfig = {
  hour_of_day: { min: 0, max: 23 },
  day_of_week: { min: 0, max: 6 },
  day_of_month: { min: 1, max: 31 },
  month: { min: 1, max: 12 },
  temperature: { min: 20, max: 40 }, // Barranquilla typical range (°C)
  humidity: { min: 0, max: 100 }, // percentage
  wind_speed: { min: 0, max: 60 }, // km/h
  rain_probability: { min: 0, max: 100 }, // percentage
  speed_kmh: { min: 0, max: 120 }, // typical speed range
  lanes: { min: 1, max: 6 }, // typical lane count
  max_speed_kmh: { min: 30, max: 100 }, // speed limit range
  distance_km: { min: 0, max: 10 }, // distance to events/arroyos
};

/**
 * Normalize a value using min-max normalization
 * Formula: (value - min) / (max - min)
 */
export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5; // avoid division by zero
  const normalized = (value - min) / (max - min);
  return Math.max(0, Math.min(1, normalized)); // clamp to [0, 1]
}

/**
 * Denormalize a value (inverse of min-max normalization)
 * Formula: value * (max - min) + min
 */
export function denormalize(normalizedValue: number, min: number, max: number): number {
  return normalizedValue * (max - min) + min;
}

/**
 * Normalize all features in a feature vector
 */
export function normalizeFeatures(
  features: Record<string, number | boolean | null>,
  config: NormalizationConfig = DEFAULT_NORMALIZATION_CONFIG
): Record<string, number> {
  const normalized: Record<string, number> = {};

  for (const [key, value] of Object.entries(features)) {
    // Skip null values
    if (value === null || value === undefined) {
      normalized[key] = 0;
      continue;
    }

    // Boolean features: convert to 0 or 1
    if (typeof value === 'boolean') {
      normalized[key] = value ? 1 : 0;
      continue;
    }

    // Numeric features: normalize based on config
    const range = config[key as keyof NormalizationConfig];
    if (range) {
      normalized[key] = normalize(value, range.min, range.max);
    } else {
      // If no range defined, assume already normalized or use as-is
      normalized[key] = value;
    }
  }

  return normalized;
}

/**
 * Compute z-score normalization (standardization)
 * Formula: (value - mean) / stddev
 */
export function standardize(value: number, mean: number, stddev: number): number {
  if (stddev === 0) return 0;
  return (value - mean) / stddev;
}

/**
 * Denormalize z-score
 */
export function destandardize(zScore: number, mean: number, stddev: number): number {
  return zScore * stddev + mean;
}

/**
 * One-hot encode a categorical value
 * @param value - The categorical value to encode
 * @param categories - List of all possible categories
 * @returns Array of 0s and 1s
 */
export function oneHotEncode(value: string, categories: string[]): number[] {
  return categories.map(cat => (cat === value ? 1 : 0));
}

/**
 * Decode one-hot encoded vector back to category
 * @param encoded - One-hot encoded vector
 * @param categories - List of all possible categories
 * @returns The decoded category (or null if invalid)
 */
export function oneHotDecode(encoded: number[], categories: string[]): string | null {
  const index = encoded.indexOf(1);
  return index >= 0 && index < categories.length ? categories[index] : null;
}

/**
 * Label encode categorical values to integers
 * @param value - The categorical value
 * @param categories - Ordered list of categories
 * @returns Integer encoding
 */
export function labelEncode(value: string, categories: string[]): number {
  const index = categories.indexOf(value);
  return index >= 0 ? index : -1;
}

/**
 * Decode label encoded value back to category
 */
export function labelDecode(encoded: number, categories: string[]): string | null {
  return encoded >= 0 && encoded < categories.length ? categories[encoded] : null;
}

/**
 * Compute feature importance scores using simple variance-based method
 * Higher variance = potentially more important feature
 */
export function computeFeatureVariance(
  features: Record<string, number[]>
): Record<string, number> {
  const variance: Record<string, number> = {};

  for (const [key, values] of Object.entries(features)) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    variance[key] = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  return variance;
}

/**
 * Apply log transformation (useful for skewed distributions)
 */
export function logTransform(value: number, base: number = Math.E): number {
  return value > 0 ? Math.log(value) / Math.log(base) : 0;
}

/**
 * Apply exponential transformation (inverse of log)
 */
export function expTransform(value: number, base: number = Math.E): number {
  return Math.pow(base, value);
}

/**
 * Clip values to a specific range
 */
export function clip(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Batch normalize an array of feature vectors
 */
export function batchNormalize(
  featureVectors: Array<Record<string, number | boolean | null>>,
  config: NormalizationConfig = DEFAULT_NORMALIZATION_CONFIG
): Array<Record<string, number>> {
  return featureVectors.map(features => normalizeFeatures(features, config));
}

/**
 * Create feature vector array for ML training
 * Converts object features to ordered array based on feature names
 */
export function featuresToArray(
  features: Record<string, number>,
  featureOrder: string[]
): number[] {
  return featureOrder.map(name => features[name] ?? 0);
}

/**
 * Convert array back to feature object
 */
export function arrayToFeatures(
  arr: number[],
  featureOrder: string[]
): Record<string, number> {
  const features: Record<string, number> = {};
  featureOrder.forEach((name, i) => {
    features[name] = arr[i] ?? 0;
  });
  return features;
}
