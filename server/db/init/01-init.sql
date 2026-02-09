-- Initialize PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Create schema for better organization
CREATE SCHEMA IF NOT EXISTS geo;
CREATE SCHEMA IF NOT EXISTS traffic;
CREATE SCHEMA IF NOT EXISTS weather;

-- Grant permissions
GRANT ALL ON SCHEMA geo TO postgres;
GRANT ALL ON SCHEMA traffic TO postgres;
GRANT ALL ON SCHEMA weather TO postgres;

-- Log initialization
DO $$
BEGIN
  RAISE NOTICE 'VíaBaq Database initialized successfully with PostGIS';
END $$;
