import { Request, Response, NextFunction } from 'express';
import { EventsService, CreateEventDTO, UpdateEventDTO } from '@/services/eventsService';
import { logger } from '@/utils/logger';
import type { ApiResponse } from '@/types';

export class EventsController {
  // GET /api/v1/events
  static async getAllEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        status: req.query.status as string | undefined,
        event_type: req.query.event_type as string | undefined,
        traffic_impact: req.query.traffic_impact as string | undefined,
        start_date: req.query.start_date as string | undefined,
        end_date: req.query.end_date as string | undefined,
      };

      const events = await EventsService.getAllEvents(filters);

      const response: ApiResponse<typeof events> = {
        status: 'success',
        data: events,
        timestamp: new Date().toISOString(),
      };

      logger.info(`Retrieved ${events.length} events`);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/events/upcoming
  static async getUpcomingEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const events = await EventsService.getUpcomingEvents();

      const response: ApiResponse<typeof events> = {
        status: 'success',
        data: events,
        timestamp: new Date().toISOString(),
      };

      logger.info(`Retrieved ${events.length} upcoming events`);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/events/near?lat=10.9639&lng=-74.7964&radius=5000
  static async getEventsNearLocation(req: Request, res: Response, next: NextFunction) {
    try {
      const latitude = parseFloat(req.query.lat as string);
      const longitude = parseFloat(req.query.lng as string);
      const radius = req.query.radius ? parseInt(req.query.radius as string, 10) : 5000;

      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid latitude or longitude',
          timestamp: new Date().toISOString(),
        });
      }

      const events = await EventsService.getEventsNearLocation(latitude, longitude, radius);

      const response: ApiResponse<typeof events> = {
        status: 'success',
        data: events,
        timestamp: new Date().toISOString(),
      };

      logger.info(`Retrieved ${events.length} events near location`);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/events/:id
  static async getEventById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(String(req.params.id), 10);

      if (isNaN(id)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid event ID',
          timestamp: new Date().toISOString(),
        });
      }

      const event = await EventsService.getEventById(id);

      if (!event) {
        return res.status(404).json({
          status: 'error',
          message: `Event with ID ${id} not found`,
          timestamp: new Date().toISOString(),
        });
      }

      const response: ApiResponse<typeof event> = {
        status: 'success',
        data: event,
        timestamp: new Date().toISOString(),
      };

      logger.info(`Retrieved event ${id}`);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/events
  static async createEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const eventData: CreateEventDTO = req.body;

      // Basic validation
      if (!eventData.title || !eventData.event_type || !eventData.location_name) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing required fields: title, event_type, location_name',
          timestamp: new Date().toISOString(),
        });
      }

      if (
        eventData.latitude === undefined ||
        eventData.longitude === undefined ||
        !eventData.start_time ||
        !eventData.end_time
      ) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing required fields: latitude, longitude, start_time, end_time',
          timestamp: new Date().toISOString(),
        });
      }

      const event = await EventsService.createEvent(eventData);

      const response: ApiResponse<typeof event> = {
        status: 'success',
        data: event,
        timestamp: new Date().toISOString(),
      };

      logger.info(`Created event: ${event.title}`);
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/v1/events/:id
  static async updateEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(String(req.params.id), 10);

      if (isNaN(id)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid event ID',
          timestamp: new Date().toISOString(),
        });
      }

      const eventData: UpdateEventDTO = req.body;
      const event = await EventsService.updateEvent(id, eventData);

      if (!event) {
        return res.status(404).json({
          status: 'error',
          message: `Event with ID ${id} not found`,
          timestamp: new Date().toISOString(),
        });
      }

      const response: ApiResponse<typeof event> = {
        status: 'success',
        data: event,
        timestamp: new Date().toISOString(),
      };

      logger.info(`Updated event ${id}`);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/events/:id
  static async deleteEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(String(req.params.id), 10);

      if (isNaN(id)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid event ID',
          timestamp: new Date().toISOString(),
        });
      }

      const deleted = await EventsService.deleteEvent(id);

      if (!deleted) {
        return res.status(404).json({
          status: 'error',
          message: `Event with ID ${id} not found`,
          timestamp: new Date().toISOString(),
        });
      }

      const response: ApiResponse<{ id: number }> = {
        status: 'success',
        data: { id },
        timestamp: new Date().toISOString(),
      };

      logger.info(`Deleted event ${id}`);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}
