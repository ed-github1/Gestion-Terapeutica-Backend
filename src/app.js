import express from 'express'
import { config } from './config/config.js'
import { connectDB } from './config/database.js'
import authRoutes from './routes/auth..js'
import invitationRoutes from './routes/invitation.js'
import cors from 'cors'
import videoRoutes from './routes/video.js'
import patientsRoutes from './routes/patients.js'
import appointmentsRouter from './routes/appointments.js'
import availabilityRouter from './routes/availability.js'
import morgan from 'morgan'
const app = express()

// Connect to MongoDB
await connectDB()

// Middlewares
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://gestionterapeutica.netlify.app',
    'https://gestionterapeutica.netlify.com',
    config.corsOrigin || 'http://localhost:5173'
  ],
  credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(morgan('dev'))
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv 
  })
})

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv 
  })
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/invitations', invitationRoutes)
app.use('/api/video', videoRoutes)
app.use('/api/patients', patientsRoutes)
app.use('/api/appointments', appointmentsRouter)
app.use('/api/availability', availabilityRouter)

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message)
  if (config.nodeEnv === 'development') {
    console.error(err.stack)
  }
  res.status(err.status || 500).json({
    success: false,
    message: config.nodeEnv === 'production' 
      ? 'Error interno del servidor' 
      : err.message
  })
})

// Start server
const PORT = config.port || 3000
app.listen(PORT, () => {
  console.log(`✅ Servidor ejecutándose en puerto ${PORT}`)
  console.log(`📍 Modo: ${config.nodeEnv}`)
  console.log(`🔗 API disponible en: ${config.apiUrl || `http://localhost:${PORT}`}`)
})

export default app
