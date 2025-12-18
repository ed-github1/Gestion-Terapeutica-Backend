import { User } from '../models/user.js';
import { Patient } from '../models/patient.js';
import { Professional } from '../models/professional.js';
import { Invitation } from '../models/invitation.js';
import { hashPassword, comparePassword, generateToken } from '../utils/auth.js';
import twilioService from '../services/twilio.service.js';
import emailService from '../services/email.service.js';

/**
 * Register a new professional
 */
export const register = async (req, res) => {
  try {
    const { email, password, nombre, apellido, firstName, lastName, role, datosPersonales } = req.body;

    console.log('📝 Register request:', { email, nombre, apellido, firstName, lastName, role, hasPassword: !!password });

    // Support both English and Spanish field names
    const finalNombre = nombre || firstName;
    const finalApellido = apellido || lastName;

    // Validate input
    if (!email || !password || !finalNombre || !finalApellido) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required (email, password, firstName/nombre, lastName/apellido)',
        missing: {
          email: !email,
          password: !password,
          nombre: !finalNombre,
          apellido: !finalApellido
        }
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'El correo electrónico ya está registrado'
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Normalize role names
    const normalizedRole = (role === 'health_professional' || role === 'professional') 
      ? 'professional' 
      : (role || 'professional');

    // Create user
    const newUser = await User.create({
      email,
      password: hashedPassword,
      nombre: finalNombre,
      apellido: finalApellido,
      role: normalizedRole
    });

    // If professional, create professional profile
    let professionalProfile = null;
    if (newUser.role === 'professional') {
      professionalProfile = await Professional.create({
        userId: newUser._id,
        datosPersonales: datosPersonales || {},
        activo: true
      });
    }

    // Generate token
    const token = generateToken({
      id: newUser._id,
      email: newUser.email,
      role: newUser.role,
      professionalId: professionalProfile?._id
    });

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: {
        user: newUser,
        professional: professionalProfile,
        token
      }
    });
  } catch (error) {
    console.error('Error en registro:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al registrar usuario'
    });
  }
};

/**
 * Login user
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
  

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
    }

    // Find user (include password for verification)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Check if user is active
    if (!user.activo) {
      return res.status(403).json({
        success: false,
        message: 'Usuario desactivado'
      });
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Get professional profile if user is professional
    let professionalProfile = null;
    if (user.role === 'professional') {
      professionalProfile = await Professional.findOne({ userId: user._id });
    }

    // Generate token with professional ID
    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role,
      professionalId: professionalProfile?._id,
      nombre: user.nombre,
      apellido: user.apellido
    });

    // Remove password before sending response
    const userResponse = user.toJSON();

    res.status(200).json({
      success: true,
      message: 'Login exitoso',
      data: {
        user: userResponse,
        professional: professionalProfile,
        token
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error al iniciar sesión'
    });
  }
  };

/**
 * Get current user profile
 */
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user: user
      }
    });
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener perfil'
    });
  }
};

/**
 * Send OTP via Twilio Verify
 * POST /api/auth/send-otp
 */
export const sendOTP = async (req, res) => {
  try {
    const { phone, channel = 'sms' } = req.body;
    
    console.log('📱 Send OTP request:', { phone, channel });
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'El número de teléfono es requerido'
      });
    }
    
    // Format phone number
    const formattedPhone = twilioService.formatPhoneNumber(phone);
    console.log('📱 Formatted phone:', formattedPhone);
    
    // Send OTP
    const result = await twilioService.sendOTP(formattedPhone, channel);
    console.log('📱 Twilio result:', result);
    
    if (!result.success) {
      console.error('❌ OTP send failed:', result.error);
      return res.status(500).json({
        success: false,
        message: 'Error al enviar el código OTP',
        error: result.error,
        code: result.code
      });
    }
    
    res.json({
      success: true,
      message: `Código OTP enviado por ${channel.toUpperCase()}`,
      data: {
        to: result.to,
        channel: result.channel
      }
    });
    
  } catch (error) {
    console.error('❌ Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar OTP',
      error: error.message
    });
  }
};

/**
 * Verify OTP code
 * POST /api/auth/verify-otp
 */
export const verifyOTP = async (req, res) => {
  try {
    const { phone, code, otp } = req.body;
    const verificationCode = code || otp; // Accept both 'code' and 'otp'
    
    console.log('🔍 Verify OTP request:', { phone, code, otp, verificationCode });
    console.log('📦 Full request body:', req.body);
    
    if (!phone || !verificationCode) {
      return res.status(400).json({
        success: false,
        message: 'Teléfono y código son requeridos'
      });
    }
    
    // Format phone number
    const formattedPhone = twilioService.formatPhoneNumber(phone);
    console.log('📱 Formatted phone for verification:', formattedPhone);
    
    // Verify OTP
    const result = await twilioService.verifyOTP(formattedPhone, verificationCode);
    console.log('✅ Twilio verify result:', result);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Código OTP inválido o expirado',
        error: result.error
      });
    }
    
    res.json({
      success: true,
      message: 'Código OTP verificado correctamente',
      data: {
        verified: result.valid
      }
    });
    
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar OTP',
      error: error.message
    });
  }
};

/**
 * Register patient with invitation code
 * POST /api/auth/register/patient
 * 
 * Frontend sends: inviteCode, password, consentimientos
 * Backend extracts all patient data from the invitation
 */
export const registerPatient = async (req, res) => {
  try {
    const { 
      inviteCode,
      invitationCode,
      password, 
      consentimientos
    } = req.body;

    const code = inviteCode || invitationCode;

    console.log('🆕 Patient registration request:', { code, hasPassword: !!password, consentimientos });

    // Validate input
    if (!code || !password) {
      return res.status(400).json({
        success: false,
        message: 'Código de invitación y contraseña son requeridos'
      });
    }

    // Verify invitation code and get patient data
    const invitation = await Invitation.findValidByCode(code);
    if (!invitation) {
      console.log('❌ Invalid or expired invitation code:', code);
      return res.status(400).json({
        success: false,
        message: 'Código de invitación inválido o expirado'
      });
    }

    // Check if already registered
    if (invitation.status === 'registered') {
      console.log('❌ Invitation already used:', code);
      return res.status(400).json({
        success: false,
        message: 'Este código de invitación ya fue utilizado'
      });
    }

    // Extract patient data from invitation
    const patientData = invitation.patientData || {};
    const email = patientData.invitationEmail || invitation.patientEmail;
    const nombre = patientData.nombre || invitation.patientName?.split(' ')[0];
    const apellido = patientData.apellido || invitation.patientName?.split(' ').slice(1).join(' ');
    const telefono = patientData.phone || invitation.patientPhone;

    console.log('📋 Extracted patient data:', { email, nombre, apellido, telefono });

    if (!email || !nombre || !apellido) {
      console.log('❌ Missing required patient data in invitation');
      return res.status(400).json({
        success: false,
        message: 'Datos incompletos en la invitación. Contacta al profesional.'
      });
    }


    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      if (user.isRegistered) {
        console.log('❌ User already exists:', email);
        return res.status(409).json({
          success: false,
          message: 'El correo electrónico ya está registrado'
        });
      } else {
        // Complete registration for invited user
        user.password = await hashPassword(password);
        user.nombre = nombre;
        user.apellido = apellido;
        user.isRegistered = true;
        await user.save();
        console.log('✅ User completed registration:', user._id);
      }
    } else {
      // Create new user
      user = await User.create({
        email,
        password: await hashPassword(password),
        nombre,
        apellido,
        role: 'patient',
        isRegistered: true
      });
      console.log('✅ User created:', user._id);
    }

    // Create patient profile with all data from invitation
    const newPatient = await Patient.create({
      userId: user._id,
      profesionalAsignado: invitation.professionalId,
      createdBy: invitation.professionalId,
      datosPersonales: {
        nombre,
        apellido,
        email,
        telefono,
        fechaNacimiento: patientData.dateOfBirth,
        genero: patientData.gender,
        direccion: {
          calle: patientData.address || '',
          ciudad: '',
          estado: '',
          codigoPostal: ''
        }
        // Add other fields as needed
      },
      contactoEmergencia: {
        nombre: patientData.emergencyContact || '',
        telefono: patientData.emergencyPhone || ''
      },
      historialMedico: {
        alergias: patientData.allergies ? [patientData.allergies] : [],
        medicamentosActuales: patientData.currentMedications ? [patientData.currentMedications] : [],
        condicionesMedicas: [],
        cirugiasPrevias: []
      },
      consentimientos: consentimientos || {
        terminosCondiciones: true,
        privacidad: true,
        comunicaciones: false
      }
    });

    console.log('✅ Patient profile created:', newPatient._id);

    // Mark invitation as used
    await invitation.markAsUsed();
    console.log('✅ Invitation marked as used');

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(email, nombre);
      console.log('✅ Welcome email sent');
    } catch (emailError) {
      console.warn('⚠️ Failed to send welcome email:', emailError.message);
      // Don't fail registration if email fails
    }

    // Generate token
    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role,
      nombre: user.nombre,
      apellido: user.apellido
    });

    res.status(201).json({
      success: true,
      message: 'Registro completado exitosamente',
      data: {
        user: {
          id: user._id,
          email: user.email,
          nombre: user.nombre,
          apellido: user.apellido,
          role: user.role
        },
        patient: newPatient,
        token
      }
    });

  } catch (error) {
    console.error('❌ Error en registro de paciente:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al registrar paciente',
      error: error.message
    });
  }
};
