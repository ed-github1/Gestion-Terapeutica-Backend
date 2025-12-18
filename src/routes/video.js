import { Router } from 'express';
import { 
  videoToken, 
  notifyPatient, 
  getActiveInvitations, 
  acceptInvitation, 
  declineInvitation 
} from '../controllers/video.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = Router();

// Generate Twilio video token
router.post('/token', videoToken);

// Video call notification endpoints
router.post('/notify-patient', authenticateToken, notifyPatient);
router.get('/active-invitations', authenticateToken, getActiveInvitations);
router.post('/accept-invitation', authenticateToken, acceptInvitation);
router.post('/decline-invitation', authenticateToken, declineInvitation);

export default router;
