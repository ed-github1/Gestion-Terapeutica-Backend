import { Router } from 'express';
import {   
  login, 
  getProfile, 
  register,
  sendOTP,
  verifyOTP,
  registerPatient
} from '../controllers/auth.js';
import { authenticateToken } from '../middlewares/auth.js';

const authRouter = Router();

// Public routes - Registration
authRouter.post('/register', register);
authRouter.post('/register/patient', registerPatient);
authRouter.post('/login', login);

// OTP routes
authRouter.post('/send-otp', sendOTP);
authRouter.post('/verify-otp', verifyOTP);

// Protected routes
authRouter.get('/profile', authenticateToken, getProfile);

export default authRouter;
