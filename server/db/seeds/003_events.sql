-- Sample events data for Barranquilla
-- Coordinates are real locations in Barranquilla

INSERT INTO events (title, description, event_type, location_name, location_point, start_time, end_time, expected_attendance, traffic_impact, status) VALUES
-- Ongoing events
('Carnaval de Barranquilla', 'Festival cultural más grande de Colombia', 'festival', 'Vía 40', ST_GeographyFromText('POINT(-74.7964 10.9895)'), '2026-02-21 08:00:00-05', '2026-02-24 23:00:00-05', 200000, 'severe', 'scheduled'),

('Mantenimiento Vía 40', 'Repavimentación tramo norte', 'maintenance', 'Vía 40 - Calle 98', ST_GeographyFromText('POINT(-74.7822 11.0156)'), '2026-02-09 06:00:00-05', '2026-02-16 18:00:00-05', NULL, 'high', 'ongoing'),

-- Upcoming events
('Concierto Estadio Metropolitano', 'Concierto internacional', 'concert', 'Estadio Metropolitano', ST_GeographyFromText('POINT(-74.8169 10.9177)'), '2026-02-15 19:00:00-05', '2026-02-15 23:30:00-05', 45000, 'high', 'scheduled'),

('Partido Junior vs Millonarios', 'Liga BetPlay', 'sports', 'Estadio Metropolitano', ST_GeographyFromText('POINT(-74.8169 10.9177)'), '2026-02-20 18:00:00-05', '2026-02-20 21:00:00-05', 38000, 'high', 'scheduled'),

('Reparación Calle 72', 'Reparación de baches y señalización', 'maintenance', 'Calle 72 con Carrera 46', ST_GeographyFromText('POINT(-74.8052 10.9894)'), '2026-02-12 22:00:00-05', '2026-02-13 05:00:00-05', NULL, 'moderate', 'scheduled'),

('Maratón Barranquilla', 'Maratón internacional', 'sports', 'Vía 40 - Malecón', ST_GeographyFromText('POINT(-74.7869 10.9894)'), '2026-03-05 06:00:00-05', '2026-03-05 12:00:00-05', 5000, 'severe', 'scheduled'),

-- Past events
('Desfile Navideño', 'Desfile de alumbrado navideño', 'parade', 'Calle 72', ST_GeographyFromText('POINT(-74.8052 10.9894)'), '2025-12-15 18:00:00-05', '2025-12-15 22:00:00-05', 50000, 'severe', 'completed'),

('Accidente Circunvalar', 'Choque múltiple', 'accident', 'Circunvalar con Carrera 38', ST_GeographyFromText('POINT(-74.8201 10.9450)'), '2026-02-08 14:30:00-05', '2026-02-08 17:00:00-05', NULL, 'severe', 'completed');

-- Update timestamps
UPDATE events SET updated_at = CURRENT_TIMESTAMP;
