import { pool } from '@/db';
import { logger } from '@/utils/logger';

export interface Event {
  id: number;
  title: string;
  description: string | null;
  event_type: string;
  location_name: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  start_time: string;
  end_time: string;
  expected_attendance: number | null;
  traffic_impact: 'low' | 'moderate' | 'high' | 'severe';
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface CreateEventDTO {
  title: string;
  description?: string;
  event_type: string;
  location_name: string;
  latitude: number;
  longitude: number;
  start_time: string;
  end_time: string;
  expected_attendance?: number;
  traffic_impact?: 'low' | 'moderate' | 'high' | 'severe';
  status?: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
}

export interface UpdateEventDTO {
  title?: string;
  description?: string;
  event_type?: string;
  location_name?: string;
  latitude?: number;
  longitude?: number;
  start_time?: string;
  end_time?: string;
  expected_attendance?: number;
  traffic_impact?: 'low' | 'moderate' | 'high' | 'severe';
  status?: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
}

export interface EventFilters {
  status?: string;
  event_type?: string;
  traffic_impact?: string;
  start_date?: string;
  end_date?: string;
}

export class EventsService {
  // Get all events with optional filters
  static async getAllEvents(filters: EventFilters = {}): Promise<Event[]> {
    try {
      let query = `
        SELECT
          id,
          title,
          description,
          event_type,
          location_name,
          ST_AsGeoJSON(location_point)::json as location,
          start_time,
          end_time,
          expected_attendance,
          traffic_impact,
          status,
          created_at,
          updated_at
        FROM events
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (filters.status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(filters.status);
      }

      if (filters.event_type) {
        query += ` AND event_type = $${paramIndex++}`;
        params.push(filters.event_type);
      }

      if (filters.traffic_impact) {
        query += ` AND traffic_impact = $${paramIndex++}`;
        params.push(filters.traffic_impact);
      }

      if (filters.start_date) {
        query += ` AND start_time >= $${paramIndex++}`;
        params.push(filters.start_date);
      }

      if (filters.end_date) {
        query += ` AND end_time <= $${paramIndex++}`;
        params.push(filters.end_date);
      }

      query += ' ORDER BY start_time ASC';

      const result = await pool.query(query, params);

      logger.info(`Retrieved ${result.rows.length} events`);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching events:', error);
      throw error;
    }
  }

  // Get event by ID
  static async getEventById(id: number): Promise<Event | null> {
    try {
      const query = `
        SELECT
          id,
          title,
          description,
          event_type,
          location_name,
          ST_AsGeoJSON(location_point)::json as location,
          start_time,
          end_time,
          expected_attendance,
          traffic_impact,
          status,
          created_at,
          updated_at
        FROM events
        WHERE id = $1
      `;

      const result = await pool.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Retrieved event ${id}`);
      return result.rows[0];
    } catch (error) {
      logger.error(`Error fetching event ${id}:`, error);
      throw error;
    }
  }

  // Get upcoming events (status = scheduled or ongoing, end_time >= now)
  static async getUpcomingEvents(): Promise<Event[]> {
    try {
      const query = `
        SELECT
          id,
          title,
          description,
          event_type,
          location_name,
          ST_AsGeoJSON(location_point)::json as location,
          start_time,
          end_time,
          expected_attendance,
          traffic_impact,
          status,
          created_at,
          updated_at
        FROM events
        WHERE (status = 'scheduled' OR status = 'ongoing')
          AND end_time >= NOW()
        ORDER BY start_time ASC
      `;

      const result = await pool.query(query);

      logger.info(`Retrieved ${result.rows.length} upcoming events`);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching upcoming events:', error);
      throw error;
    }
  }

  // Get events within a geographical radius (in meters)
  static async getEventsNearLocation(
    latitude: number,
    longitude: number,
    radiusMeters: number = 5000
  ): Promise<Event[]> {
    try {
      const query = `
        SELECT
          id,
          title,
          description,
          event_type,
          location_name,
          ST_AsGeoJSON(location_point)::json as location,
          start_time,
          end_time,
          expected_attendance,
          traffic_impact,
          status,
          created_at,
          updated_at,
          ST_Distance(location_point, ST_GeographyFromText('POINT($2 $1)')) as distance
        FROM events
        WHERE ST_DWithin(location_point, ST_GeographyFromText('POINT($2 $1)'), $3)
          AND (status = 'scheduled' OR status = 'ongoing')
          AND end_time >= NOW()
        ORDER BY distance ASC
      `;

      const result = await pool.query(query, [latitude, longitude, radiusMeters]);

      logger.info(`Retrieved ${result.rows.length} events near location`);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching events near location:', error);
      throw error;
    }
  }

  // Create new event
  static async createEvent(eventData: CreateEventDTO): Promise<Event> {
    try {
      const query = `
        INSERT INTO events (
          title,
          description,
          event_type,
          location_name,
          location_point,
          start_time,
          end_time,
          expected_attendance,
          traffic_impact,
          status
        ) VALUES ($1, $2, $3, $4, ST_GeographyFromText('POINT($6 $5)'), $7, $8, $9, $10, $11)
        RETURNING
          id,
          title,
          description,
          event_type,
          location_name,
          ST_AsGeoJSON(location_point)::json as location,
          start_time,
          end_time,
          expected_attendance,
          traffic_impact,
          status,
          created_at,
          updated_at
      `;

      const values = [
        eventData.title,
        eventData.description || null,
        eventData.event_type,
        eventData.location_name,
        eventData.latitude,
        eventData.longitude,
        eventData.start_time,
        eventData.end_time,
        eventData.expected_attendance || null,
        eventData.traffic_impact || 'moderate',
        eventData.status || 'scheduled',
      ];

      const result = await pool.query(query, values);

      logger.info(`Created event: ${eventData.title}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating event:', error);
      throw error;
    }
  }

  // Update event
  static async updateEvent(id: number, eventData: UpdateEventDTO): Promise<Event | null> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (eventData.title !== undefined) {
        fields.push(`title = $${paramIndex++}`);
        values.push(eventData.title);
      }

      if (eventData.description !== undefined) {
        fields.push(`description = $${paramIndex++}`);
        values.push(eventData.description);
      }

      if (eventData.event_type !== undefined) {
        fields.push(`event_type = $${paramIndex++}`);
        values.push(eventData.event_type);
      }

      if (eventData.location_name !== undefined) {
        fields.push(`location_name = $${paramIndex++}`);
        values.push(eventData.location_name);
      }

      if (eventData.latitude !== undefined && eventData.longitude !== undefined) {
        fields.push(`location_point = ST_GeographyFromText('POINT($${paramIndex + 1} $${paramIndex})')`);
        values.push(eventData.latitude);
        values.push(eventData.longitude);
        paramIndex += 2;
      }

      if (eventData.start_time !== undefined) {
        fields.push(`start_time = $${paramIndex++}`);
        values.push(eventData.start_time);
      }

      if (eventData.end_time !== undefined) {
        fields.push(`end_time = $${paramIndex++}`);
        values.push(eventData.end_time);
      }

      if (eventData.expected_attendance !== undefined) {
        fields.push(`expected_attendance = $${paramIndex++}`);
        values.push(eventData.expected_attendance);
      }

      if (eventData.traffic_impact !== undefined) {
        fields.push(`traffic_impact = $${paramIndex++}`);
        values.push(eventData.traffic_impact);
      }

      if (eventData.status !== undefined) {
        fields.push(`status = $${paramIndex++}`);
        values.push(eventData.status);
      }

      if (fields.length === 0) {
        return this.getEventById(id);
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `
        UPDATE events
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING
          id,
          title,
          description,
          event_type,
          location_name,
          ST_AsGeoJSON(location_point)::json as location,
          start_time,
          end_time,
          expected_attendance,
          traffic_impact,
          status,
          created_at,
          updated_at
      `;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Updated event ${id}`);
      return result.rows[0];
    } catch (error) {
      logger.error(`Error updating event ${id}:`, error);
      throw error;
    }
  }

  // Delete event
  static async deleteEvent(id: number): Promise<boolean> {
    try {
      const query = 'DELETE FROM events WHERE id = $1 RETURNING id';
      const result = await pool.query(query, [id]);

      if (result.rows.length === 0) {
        return false;
      }

      logger.info(`Deleted event ${id}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting event ${id}:`, error);
      throw error;
    }
  }
}