import express from 'express';
import * as availabilityController from '../controllers/availability.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', availabilityController.getAvailability);
router.put('/', availabilityController.updateAvailability);

export default router;
