import { Router } from 'express';
import { EventsController } from '@/controllers/eventsController';

const router = Router();

// Get all events (with optional filters)
router.get('/', EventsController.getAllEvents);

// Get upcoming events
router.get('/upcoming', EventsController.getUpcomingEvents);

// Get events near a location
router.get('/near', EventsController.getEventsNearLocation);

// Get event by ID
router.get('/:id', EventsController.getEventById);

// Create new event
router.post('/', EventsController.createEvent);

// Update event
router.put('/:id', EventsController.updateEvent);

// Delete event
router.delete('/:id', EventsController.deleteEvent);

export default router;