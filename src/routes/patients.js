import { Router } from 'express';
import multer from 'multer';
import { createPatient, uploadPatientPhoto, uploadPatientDocuments, addDiaryNote, getDiaryNotes, getAllPatients } from '../controllers/patients.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/patients/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Apply authentication middleware to all routes
router.use(authenticateToken);

// List all patients (professionals and admins)
router.get('/', requireRole('professional', 'admin'), getAllPatients);
// Create patient (professionals and admins only)
router.post('/', requireRole('professional', 'admin'), createPatient);
// Upload patient photo
router.post('/:id/photo', upload.single('photo'), uploadPatientPhoto);
// Upload patient documents
router.post('/:id/documents', upload.array('documents'), uploadPatientDocuments);

// Add a diary note
router.post('/:id/diary-notes', addDiaryNote);

// Get all diary notes
router.get('/:id/diary-notes', getDiaryNotes);

export default router;
