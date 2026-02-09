-- Geographical zones of Barranquilla
CREATE TABLE IF NOT EXISTS geo.zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    zone_type VARCHAR(50) NOT NULL, -- 'neighborhood', 'locality', 'district'
    parent_id INTEGER REFERENCES geo.zones(id),
    geometry GEOMETRY(MultiPolygon, 4326) NOT NULL,
    population INTEGER,
    area_km2 NUMERIC(10, 4),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for spatial queries
CREATE INDEX idx_zones_geometry ON geo.zones USING GIST(geometry);
CREATE INDEX idx_zones_zone_type ON geo.zones(zone_type);
CREATE INDEX idx_zones_parent_id ON geo.zones(parent_id);

-- Main roads and streets of Barranquilla
CREATE TABLE IF NOT EXISTS geo.roads (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    road_type VARCHAR(50) NOT NULL, -- 'highway', 'avenue', 'street', 'transversal', 'carrera', 'calle'
    geometry GEOMETRY(LineString, 4326) NOT NULL,
    lanes INTEGER,
    max_speed_kmh INTEGER,
    length_km NUMERIC(10, 4),
    one_way BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_roads_geometry ON geo.roads USING GIST(geometry);
CREATE INDEX idx_roads_road_type ON geo.roads(road_type);
CREATE INDEX idx_roads_name ON geo.roads(name);

-- Arroyo zones (flood-prone areas)
CREATE TABLE IF NOT EXISTS geo.arroyo_zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    zone_id INTEGER REFERENCES geo.zones(id),
    geometry GEOMETRY(MultiPolygon, 4326) NOT NULL,
    risk_level VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    drainage_capacity_m3 NUMERIC(10, 2),
    last_incident_date TIMESTAMP,
    avg_flood_depth_cm NUMERIC(6, 2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_arroyo_geometry ON geo.arroyo_zones USING GIST(geometry);
CREATE INDEX idx_arroyo_risk_level ON geo.arroyo_zones(risk_level);
CREATE INDEX idx_arroyo_zone_id ON geo.arroyo_zones(zone_id);

-- Points of Interest (POIs)
CREATE TABLE IF NOT EXISTS geo.pois (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL, -- 'hospital', 'school', 'mall', 'stadium', 'government', 'transport_hub'
    geometry GEOMETRY(Point, 4326) NOT NULL,
    zone_id INTEGER REFERENCES geo.zones(id),
    address TEXT,
    capacity INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pois_geometry ON geo.pois USING GIST(geometry);
CREATE INDEX idx_pois_category ON geo.pois(category);
CREATE INDEX idx_pois_zone_id ON geo.pois(zone_id);

-- Traffic segments (for traffic analysis)
CREATE TABLE IF NOT EXISTS traffic.segments (
    id SERIAL PRIMARY KEY,
    road_id INTEGER REFERENCES geo.roads(id),
    segment_order INTEGER NOT NULL,
    geometry GEOMETRY(LineString, 4326) NOT NULL,
    start_point GEOMETRY(Point, 4326) NOT NULL,
    end_point GEOMETRY(Point, 4326) NOT NULL,
    length_km NUMERIC(10, 4) NOT NULL,
    typical_speed_kmh INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_segments_geometry ON traffic.segments USING GIST(geometry);
CREATE INDEX idx_segments_road_id ON traffic.segments(road_id);

-- Weather stations (real or virtual)
CREATE TABLE IF NOT EXISTS weather.stations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    station_type VARCHAR(50) NOT NULL, -- 'real', 'virtual'
    geometry GEOMETRY(Point, 4326) NOT NULL,
    zone_id INTEGER REFERENCES geo.zones(id),
    elevation_m INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_stations_geometry ON weather.stations USING GIST(geometry);
CREATE INDEX idx_stations_zone_id ON weather.stations(zone_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to tables
CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON geo.zones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roads_updated_at BEFORE UPDATE ON geo.roads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_arroyo_zones_updated_at BEFORE UPDATE ON geo.arroyo_zones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pois_updated_at BEFORE UPDATE ON geo.pois
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stations_updated_at BEFORE UPDATE ON weather.stations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
