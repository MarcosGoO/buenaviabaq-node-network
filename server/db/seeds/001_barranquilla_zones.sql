-- Seed data for Barranquilla geographical zones and key infrastructure
-- SRID 4326 = WGS 84 (standard GPS coordinates)
-- This seed is idempotent and can be run multiple times safely

-- First, add unique constraints if they don't exist
DO $$
BEGIN
    -- Add unique constraint on zones name if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_zones_name'
    ) THEN
        ALTER TABLE geo.zones ADD CONSTRAINT uq_zones_name UNIQUE (name);
    END IF;

    -- Add unique constraint on roads name if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_roads_name'
    ) THEN
        ALTER TABLE geo.roads ADD CONSTRAINT uq_roads_name UNIQUE (name);
    END IF;

    -- Add unique constraint on arroyo_zones name if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_arroyo_zones_name'
    ) THEN
        ALTER TABLE geo.arroyo_zones ADD CONSTRAINT uq_arroyo_zones_name UNIQUE (name);
    END IF;

    -- Add unique constraint on pois name if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_pois_name'
    ) THEN
        ALTER TABLE geo.pois ADD CONSTRAINT uq_pois_name UNIQUE (name);
    END IF;

    -- Add unique constraint on weather stations name if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_stations_name'
    ) THEN
        ALTER TABLE weather.stations ADD CONSTRAINT uq_stations_name UNIQUE (name);
    END IF;
END $$;

-- Main localities of Barranquilla
INSERT INTO geo.zones (name, zone_type, geometry, population, area_km2, metadata) VALUES
-- Centro Histórico
('Centro', 'locality', ST_GeomFromText('MULTIPOLYGON(((-74.7850 10.9880, -74.7750 10.9880, -74.7750 10.9780, -74.7850 10.9780, -74.7850 10.9880)))', 4326), 45000, 2.5, '{"description": "Historic downtown area"}'),

-- Norte Centro Histórico
('Norte Centro Histórico', 'locality', ST_GeomFromText('MULTIPOLYGON(((-74.7950 11.0100, -74.7750 11.0100, -74.7750 10.9900, -74.7950 10.9900, -74.7950 11.0100)))', 4326), 150000, 12.8, '{"description": "Northern historic center"}'),

-- Riomar (zona norte exclusiva)
('Riomar', 'locality', ST_GeomFromText('MULTIPOLYGON(((-74.7950 11.0200, -74.7800 11.0200, -74.7800 11.0050, -74.7950 11.0050, -74.7950 11.0200)))', 4326), 35000, 3.2, '{"description": "High-end northern zone, shopping district"}'),

-- Barrio Abajo
('Barrio Abajo', 'locality', ST_GeomFromText('MULTIPOLYGON(((-74.7900 10.9850, -74.7800 10.9850, -74.7800 10.9750, -74.7900 10.9750, -74.7900 10.9850)))', 4326), 28000, 1.8, '{"description": "Traditional neighborhood"}'),

-- El Prado
('El Prado', 'locality', ST_GeomFromText('MULTIPOLYGON(((-74.8000 11.0000, -74.7850 11.0000, -74.7850 10.9850, -74.8000 10.9850, -74.8000 11.0000)))', 4326), 42000, 3.5, '{"description": "Historic upscale residential area"}'),

-- Soledad (neighboring municipality, part of metro area)
('Soledad', 'locality', ST_GeomFromText('MULTIPOLYGON(((-74.7800 10.9200, -74.7500 10.9200, -74.7500 10.8900, -74.7800 10.8900, -74.7800 10.9200)))', 4326), 650000, 65.0, '{"description": "Adjacent municipality, high density"}'),

-- Metropolitana (zona sur)
('Metropolitana', 'locality', ST_GeomFromText('MULTIPOLYGON(((-74.8100 10.9600, -74.7900 10.9600, -74.7900 10.9400, -74.8100 10.9400, -74.8100 10.9600)))', 4326), 280000, 18.5, '{"description": "Southern metropolitan zone"}')
ON CONFLICT (name) DO NOTHING;

-- Major roads and avenues of Barranquilla
INSERT INTO geo.roads (name, road_type, geometry, lanes, max_speed_kmh, length_km, one_way, metadata) VALUES
-- Vía 40 (Circunvalar)
('Vía 40 (Circunvalar)', 'highway', ST_GeomFromText('LINESTRING(-74.8200 10.9300, -74.8100 10.9500, -74.8000 10.9700, -74.7900 10.9900)', 4326), 6, 80, 8.5, false, '{"importance": "high", "transmilenio_route": false}'),

-- Calle 72 (Vía al mar)
('Calle 72 (Vía al Mar)', 'highway', ST_GeomFromText('LINESTRING(-74.8100 11.0100, -74.7900 11.0100, -74.7700 11.0100, -74.7500 11.0100)', 4326), 4, 60, 6.2, false, '{"importance": "high", "beach_access": true}'),

-- Carrera 38
('Carrera 38', 'avenue', ST_GeomFromText('LINESTRING(-74.7850 10.9500, -74.7850 10.9700, -74.7850 10.9900, -74.7850 11.0100)', 4326), 4, 50, 7.8, false, '{"importance": "medium", "commercial": true}'),

-- Calle 30 (Centro)
('Calle 30', 'street', ST_GeomFromText('LINESTRING(-74.7950 10.9750, -74.7850 10.9750, -74.7750 10.9750)', 4326), 2, 40, 2.5, false, '{"importance": "medium", "historic": true}'),

-- Carrera 46 (Autopista al Aeropuerto)
('Carrera 46 (Autopista al Aeropuerto)', 'highway', ST_GeomFromText('LINESTRING(-74.7800 10.8900, -74.7800 10.9100, -74.7800 10.9300, -74.7800 10.9500)', 4326), 6, 80, 8.0, false, '{"importance": "critical", "airport_access": true}'),

-- Calle 93 (Norte)
('Calle 93', 'avenue', ST_GeomFromText('LINESTRING(-74.8000 11.0200, -74.7850 11.0200, -74.7700 11.0200)', 4326), 4, 60, 3.5, false, '{"importance": "high", "commercial": true}')
ON CONFLICT (name) DO NOTHING;

-- Critical arroyo zones (flood-prone areas)
INSERT INTO geo.arroyo_zones (name, zone_id, geometry, risk_level, drainage_capacity_m3, avg_flood_depth_cm, metadata) VALUES
-- Arroyo Don Juan
('Arroyo Don Juan', (SELECT id FROM geo.zones WHERE name = 'Centro' LIMIT 1),
 ST_GeomFromText('MULTIPOLYGON(((-74.7880 10.9820, -74.7850 10.9820, -74.7850 10.9790, -74.7880 10.9790, -74.7880 10.9820)))', 4326),
 'critical', 1200.00, 45.00, '{"historical_incidents": 15, "last_major_flood": "2023-10-15"}'),

-- Arroyo de la 84
('Arroyo de la 84', (SELECT id FROM geo.zones WHERE name = 'Riomar' LIMIT 1),
 ST_GeomFromText('MULTIPOLYGON(((-74.7900 11.0150, -74.7870 11.0150, -74.7870 11.0120, -74.7900 11.0120, -74.7900 11.0150)))', 4326),
 'high', 1500.00, 35.00, '{"historical_incidents": 8, "improved_drainage": true}'),

-- Arroyo del Country
('Arroyo del Country', (SELECT id FROM geo.zones WHERE name = 'Norte Centro Histórico' LIMIT 1),
 ST_GeomFromText('MULTIPOLYGON(((-74.7850 10.9950, -74.7820 10.9950, -74.7820 10.9920, -74.7850 10.9920, -74.7850 10.9950)))', 4326),
 'high', 1000.00, 40.00, '{"historical_incidents": 12, "active_monitoring": true}'),

-- Arroyo de la 41
('Arroyo de la 41', (SELECT id FROM geo.zones WHERE name = 'Soledad' LIMIT 1),
 ST_GeomFromText('MULTIPOLYGON(((-74.7650 10.9050, -74.7620 10.9050, -74.7620 10.9020, -74.7650 10.9020, -74.7650 10.9050)))', 4326),
 'medium', 800.00, 30.00, '{"historical_incidents": 6}')
ON CONFLICT (name) DO NOTHING;

-- Points of Interest
INSERT INTO geo.pois (name, category, geometry, zone_id, address, capacity, metadata) VALUES
-- Shopping centers
('Centro Comercial Buenavista', 'mall', ST_GeomFromText('POINT(-74.7950 11.0050)', 4326), (SELECT id FROM geo.zones WHERE name = 'Riomar' LIMIT 1), 'Calle 98 con Carrera 53', 5000, '{"parking_spots": 1200, "floors": 3}'),
('Centro Comercial Único', 'mall', ST_GeomFromText('POINT(-74.7850 10.9920)', 4326), (SELECT id FROM geo.zones WHERE name = 'Norte Centro Histórico' LIMIT 1), 'Calle 82 con Carrera 53', 4000, '{"parking_spots": 800}'),

-- Hospitals
('Clínica Portoazul', 'hospital', ST_GeomFromText('POINT(-74.7890 11.0100)', 4326), (SELECT id FROM geo.zones WHERE name = 'Riomar' LIMIT 1), 'Carrera 53 No. 98-56', 300, '{"emergency_room": true, "icu_beds": 40}'),
('Hospital Universidad del Norte', 'hospital', ST_GeomFromText('POINT(-74.7820 11.0180)', 4326), (SELECT id FROM geo.zones WHERE name = 'Riomar' LIMIT 1), 'Km 5 Vía Puerto Colombia', 400, '{"trauma_center": true}'),

-- Stadiums
('Estadio Metropolitano Roberto Meléndez', 'stadium', ST_GeomFromText('POINT(-74.8080 10.9520)', 4326), (SELECT id FROM geo.zones WHERE name = 'Metropolitana' LIMIT 1), 'Calle 72 con Circunvalar', 46788, '{"events_cause_traffic": true, "major_venue": true}'),

-- Universities
('Universidad del Norte', 'school', ST_GeomFromText('POINT(-74.7810 11.0190)', 4326), (SELECT id FROM geo.zones WHERE name = 'Riomar' LIMIT 1), 'Km 5 Vía Puerto Colombia', 18000, '{"students": 18000, "peak_hours": "7-9am, 5-7pm"}'),
('Universidad del Atlántico', 'school', ST_GeomFromText('POINT(-74.7920 10.9850)', 4326), (SELECT id FROM geo.zones WHERE name = 'Norte Centro Histórico' LIMIT 1), 'Carrera 30', 25000, '{"students": 25000, "public_university": true}'),

-- Transport hubs
('Terminal de Transportes', 'transport_hub', ST_GeomFromText('POINT(-74.8070 10.9450)', 4326), (SELECT id FROM geo.zones WHERE name = 'Metropolitana' LIMIT 1), 'Carrera 14 con Calle 54', 3000, '{"intercity_buses": true, "daily_passengers": 15000}'),
('Aeropuerto Ernesto Cortissoz', 'transport_hub', ST_GeomFromText('POINT(-74.7810 10.8900)', 4326), (SELECT id FROM geo.zones WHERE name = 'Soledad' LIMIT 1), 'Vía Soledad', 8000, '{"international": true, "daily_flights": 80}')
ON CONFLICT (name) DO NOTHING;

-- Weather stations (virtual grid for coverage)
INSERT INTO weather.stations (name, station_type, geometry, zone_id, elevation_m, metadata) VALUES
('Estación Virtual Centro', 'virtual', ST_GeomFromText('POINT(-74.7800 10.9800)', 4326), (SELECT id FROM geo.zones WHERE name = 'Centro' LIMIT 1), 5, '{"data_source": "openweather"}'),
('Estación Virtual Norte', 'virtual', ST_GeomFromText('POINT(-74.7850 11.0100)', 4326), (SELECT id FROM geo.zones WHERE name = 'Riomar' LIMIT 1), 8, '{"data_source": "openweather"}'),
('Estación Virtual Sur', 'virtual', ST_GeomFromText('POINT(-74.7950 10.9400)', 4326), (SELECT id FROM geo.zones WHERE name = 'Metropolitana' LIMIT 1), 3, '{"data_source": "openweather"}'),
('Estación Real Aeropuerto', 'real', ST_GeomFromText('POINT(-74.7810 10.8895)', 4326), (SELECT id FROM geo.zones WHERE name = 'Soledad' LIMIT 1), 12, '{"data_source": "IDEAM", "station_code": "13015020"}')
ON CONFLICT (name) DO NOTHING;

-- Verification query
SELECT
    'Zones' as entity, COUNT(*) as count FROM geo.zones
UNION ALL
SELECT 'Roads', COUNT(*) FROM geo.roads
UNION ALL
SELECT 'Arroyo Zones', COUNT(*) FROM geo.arroyo_zones
UNION ALL
SELECT 'POIs', COUNT(*) FROM geo.pois
UNION ALL
SELECT 'Weather Stations', COUNT(*) FROM weather.stations;