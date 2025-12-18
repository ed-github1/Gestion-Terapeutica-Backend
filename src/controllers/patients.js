import { Patient } from '../models/patient.js'
import { User } from '../models/user.js'
import { Professional } from '../models/professional.js'
import { hashPassword } from '../utils/auth.js'
import mongoose from 'mongoose'

export const createPatient = async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    console.log('Received patient data:', req.body)

    const {
      email,
      password,
      nombre,
      apellido,
      datosPersonales,
      contactoEmergencia,
      historialMedico,
      historialPsicologico,
      seguro
    } = req.body

    // Get professional ID from token
    const professionalId = req.user.professionalId

    // Validate required fields
    if (!nombre || !apellido) {
      await session.abortTransaction()
      return res.status(400).json({
        success: false,
        message: 'Nombre y apellido son requeridos',
        received: Object.keys(req.body)
      })
    }

    // Generate email from phone if not provided
    const patientEmail =
      email ||
      (datosPersonales?.telefono
        ? `${nombre.toLowerCase()}.${apellido.toLowerCase()}.${datosPersonales.telefono
            .replace(/\D/g, '')
            .slice(-4)}@temp.gestionterapeutica.com`
        : `${nombre.toLowerCase()}.${apellido.toLowerCase()}.${Date.now()}@temp.gestionterapeutica.com`)

    // Generate a default password if not provided (for professional-created patients)
    const patientPassword =
      password || Math.random().toString(36).slice(-8) + 'Aa1!'

    // Check if user already exists
    const existingUser = await User.findOne({ email: patientEmail })
    if (existingUser) {
      await session.abortTransaction()
      return res.status(409).json({
        success: false,
        message: 'El correo electrónico ya está registrado'
      })
    }

    // Hash password
    const hashedPassword = await hashPassword(patientPassword)

    // Create user
    const [newUser] = await User.create(
      [
        {
          email: patientEmail,
          password: hashedPassword,
          nombre,
          apellido,
          rol: 'patient',
          activo: true
        }
      ],
      { session }
    )

    // Prepare patient data - handle nested fields from frontend
    const patientDataPersonales = {
      telefono: datosPersonales?.telefono,
      fechaNacimiento: datosPersonales?.fecha_nacimiento,
      genero: datosPersonales?.genero,
      direccion: {
        calle: datosPersonales?.direccion || ''
      }
    }

    const patientHistorialMedico = {
      alergias: datosPersonales?.alergias ? [datosPersonales.alergias] : [],
      medicamentosActuales: datosPersonales?.medicamentos_actuales
        ? [datosPersonales.medicamentos_actuales]
        : [],
      condicionesMedicas: datosPersonales?.historial_medico
        ? [datosPersonales.historial_medico]
        : []
    }

    // Create patient profile
    const [newPatient] = await Patient.create(
      [
        {
          userId: newUser._id,
          createdBy: professionalId,
          profesionalAsignado: professionalId,
          datosPersonales: patientDataPersonales,
          contactoEmergencia: contactoEmergencia || {},
          historialMedico: patientHistorialMedico,
          historialPsicologico: historialPsicologico || {},
          seguro: seguro || {},
          activo: true
        }
      ],
      { session }
    )

    // Update professional patient count
    await Professional.findByIdAndUpdate(
      professionalId,
      {
        $inc: {
          'estadisticas.totalPacientes': 1,
          'estadisticas.pacientesActivos': 1
        }
      },
      { session }
    )

    await session.commitTransaction()

    res.status(201).json({
      success: true,
      message: 'Paciente creado exitosamente',
      data: {
        user: newUser.toJSON(),
        patient: newPatient
      }
    })
  } catch (error) {
    await session.abortTransaction()
    console.error('Error creating patient:', error)

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: Object.values(error.errors).map((err) => err.message)
      })
    }

    res.status(500).json({
      success: false,
      message: 'Error al crear paciente',
      error: error.message
    })
  } finally {
    session.endSession()
  }
}

export const uploadPatientPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: 'No se subió ninguna foto' })
    }
    // Save file path to patient profile (implement as needed)
    res
      .status(200)
      .json({ success: true, message: 'Foto subida', file: req.file.filename })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al subir foto' })
  }
}

export const uploadPatientDocuments = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: 'No se subieron documentos' })
    }
    // Save file paths to patient profile (implement as needed)
    res.status(200).json({
      success: true,
      message: 'Documentos subidos',
      files: req.files.map((f) => f.filename)
    })
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: 'Error al subir documentos' })
  }
}

export const addDiaryNote = async (req, res) => {
  try {
    const { id } = req.params
    const { text, author } = req.body
    const createdBy = req.user.professionalId // Get professional ID from authenticated user

    if (!text) {
      return res
        .status(400)
        .json({ success: false, message: 'El texto de la nota es requerido' })
    }
    const patient = await Patient.findById(id)
    if (!patient) {
      return res
        .status(404)
        .json({ success: false, message: 'Paciente no encontrado' })
    }
    patient.diaryNotes.push({ text, author, createdBy })
    await patient.save()
    res.status(201).json({
      success: true,
      message: 'Nota agregada',
      notes: patient.diaryNotes
    })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al agregar nota' })
  }
}

export const getDiaryNotes = async (req, res) => {
  try {
    const { id } = req.params
    const patient = await Patient.findById(id, 'diaryNotes')
    if (!patient) {
      return res
        .status(404)
        .json({ success: false, message: 'Paciente no encontrado' })
    }
    res.status(200).json({ success: true, notes: patient.diaryNotes })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener notas' })
  }
}

export const getAllPatients = async (req, res) => {
  try {
    const professionalId = req.user.professionalId
    const userRole = req.user.role
    // If admin, show all patients. If professional, only show their patients
    const query = userRole === 'admin' ? {} : { createdBy: professionalId }

    const patients = await Patient.find(query)
      .populate('userId', 'nombre apellido email')
      .populate({
        path: 'createdBy',
        populate: { path: 'userId', select: 'nombre apellido email' }
      })
      .populate({
        path: 'profesionalAsignado',
        populate: { path: 'userId', select: 'nombre apellido email' }
      })
      .sort({ createdAt: -1 })

    res.status(200).json({ success: true, data: patients })
  } catch (error) {
    console.error('Error getting patients:', error)
    res
      .status(500)
      .json({ success: false, message: 'Error al obtener pacientes' })
  }
}
