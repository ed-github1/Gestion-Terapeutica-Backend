import express from 'express';
import * as appointmentsController from '../controllers/appointments.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/available-slots', appointmentsController.getAvailableSlots);
router.post('/reserve', appointmentsController.reserveAppointment);
router.post('/', appointmentsController.createAppointment);
router.get('/', appointmentsController.getAppointments);
router.get('/upcoming', appointmentsController.getUpcomingAppointments);
router.get('/statistics', appointmentsController.getStatistics);
router.get('/:id', appointmentsController.getAppointmentById);
router.put('/:id', appointmentsController.updateAppointment);
router.put('/:id/cancel', appointmentsController.cancelAppointment);
router.put('/:id/confirm', appointmentsController.confirmAppointment);
router.put('/:id/complete', appointmentsController.completeAppointment);
router.put('/:id/reschedule', appointmentsController.rescheduleAppointment);
router.post('/:id/send-video-link', appointmentsController.sendVideoLink);
router.delete('/:id', appointmentsController.deleteAppointment);

export default router;
