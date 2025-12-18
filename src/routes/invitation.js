import express from 'express'
import {
  sendInvitation,
  verifyInvitation,
  getInvitations,
  getInvitationById,
  cancelInvitation,
  resendInvitation,
  getInvitationStats
} from '../controllers/invitation..js'
import { authenticateToken } from '../middlewares/auth.js'

const router = express.Router()

// Public routes
router.get('/verify/:code', verifyInvitation)

// Protected routes (require authentication)
router.use(authenticateToken)

router.post('/send', sendInvitation)
router.get('/stats', getInvitationStats)
router.get('/', getInvitations)
router.get('/:id', getInvitationById)
router.put('/:id/cancel', cancelInvitation)
router.post('/:id/resend', resendInvitation)

export default router
