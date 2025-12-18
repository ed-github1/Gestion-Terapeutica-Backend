import cryptoRandomString from 'crypto-random-string';
import { Invitation } from '../models/invitation.js';
import twilioService from '../services/twilio.service.js';
import emailService from '../services/email.service.js';

/**
 * Generate unique invitation code
 */
const generateInvitationCode = async () => {
  let code;
  let exists = true;
  
  while (exists) {
    code = cryptoRandomString({ length: 8, type: 'alphanumeric' }).toUpperCase();
    exists = await Invitation.findOne({ code });
  }
  
  return code;
};

/**
 * Send invitation via SMS and/or Email
 * POST /api/invitations/send
 */
export const sendInvitation = async (req, res) => {
  try {
    const { 
      patientName, 
      patientEmail, 
      patientPhone, 
      channels = ['EMAIL'], 
      customMessage, 
      expirationDays = 7,
      // Extended patient data
      nombre,
      apellido,
      phone,
      dateOfBirth,
      gender,
      address,
      emergencyContact,
      emergencyPhone,
      medicalHistory,
      allergies,
      currentMedications,
      invitationEmail
    } = req.body;
    const professionalId = req.user.professionalId || req.user.id; // From auth middleware
    
    console.log('📨 Send invitation request:', { 
      patientName, 
      nombre, 
      apellido, 
      phone: phone || patientPhone,
      patientEmail,
      invitationEmail,
      channels,
      professionalId 
    });
    
    // Support both formats: patientName or nombre/apellido
    const finalPatientName = patientName || `${nombre} ${apellido}`;
    const finalPhone = phone || patientPhone;
    const finalEmail = invitationEmail || patientEmail;
    
    // Validation
    if (!finalPatientName || (!nombre && !apellido)) {
      return res.status(400).json({ 
        success: false, 
        message: 'El nombre del paciente es requerido (patientName o nombre/apellido)' 
      });
    }
    
    if (!finalEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'El email del paciente es requerido' 
      });
    }
    
    // Phone is optional now
    if (channels.includes('SMS') && !finalPhone) {
      return res.status(400).json({ 
        success: false, 
        message: 'El número de teléfono es requerido para envío por SMS' 
      });
    }
    
    // Generate invitation code
    const code = await generateInvitationCode();
    
    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);
    
    // Create invitation with extended patient data
    const invitation = new Invitation({
      code,
      professionalId,
      patientName: finalPatientName,
      patientEmail: finalEmail,
      patientPhone: finalPhone,
      patientData: {
        nombre: nombre || patientName?.split(' ')[0],
        apellido: apellido || patientName?.split(' ').slice(1).join(' '),
        phone: finalPhone,
        dateOfBirth,
        gender,
        address,
        emergencyContact,
        emergencyPhone,
        medicalHistory,
        allergies,
        currentMedications,
        invitationEmail: finalEmail
      },
      customMessage,
      channels,
      expiresAt
    });
    
    // Get professional info
    const professionalName = `${req.user.nombre} ${req.user.apellido}`;
    
    // Send via selected channels
    const results = [];
    
    // Send SMS
    if (channels.includes('SMS')) {
      const formattedPhone = twilioService.formatPhoneNumber(finalPhone);
      const smsResult = await twilioService.sendInvitationSMS(
        formattedPhone,
        finalPatientName,
        code,
        professionalName,
        customMessage
      );
      
      invitation.logs.push({
        channel: 'SMS',
        status: smsResult.success ? 'sent' : 'failed',
        providerId: smsResult.messageId,
        providerStatus: smsResult.status,
        errorMessage: smsResult.error
      });
      
      results.push({ channel: 'SMS', ...smsResult });
    }
    
    // Send WhatsApp
    if (channels.includes('WHATSAPP')) {
      const formattedPhone = twilioService.formatPhoneNumber(finalPhone);
      const whatsappResult = await twilioService.sendInvitationWhatsApp(
        formattedPhone,
        finalPatientName,
        code,
        professionalName,
        customMessage
      );
      
      invitation.logs.push({
        channel: 'WHATSAPP',
        status: whatsappResult.success ? 'sent' : 'failed',
        providerId: whatsappResult.messageId,
        providerStatus: whatsappResult.status,
        errorMessage: whatsappResult.error
      });
      
      results.push({ channel: 'WHATSAPP', ...whatsappResult });
    }
    
    // Send Email
    if (channels.includes('EMAIL')) {
      const emailResult = await emailService.sendInvitationEmail(
        finalEmail,
        finalPatientName,
        code,
        professionalName,
        customMessage
      );
      
      invitation.logs.push({
        channel: 'EMAIL',
        status: emailResult.success ? 'sent' : 'failed',
        providerId: emailResult.messageId,
        errorMessage: emailResult.error
      });
      
      results.push({ channel: 'EMAIL', ...emailResult });
    }
    
    // Save invitation even if sending failed
    await invitation.save();
    
    // Check if at least one channel succeeded
    const anySuccess = results.some(r => r.success);
    
    console.log('📧 Invitation send results:', { code, anySuccess, results });
    
    if (!anySuccess) {
      // Return 201 with warning instead of 500 - invitation is created
      return res.status(201).json({
        success: true,
        warning: 'Invitación creada pero no se pudo enviar por ningún canal (verifica números verificados en Twilio)',
        message: 'Invitation code created but delivery failed. Patient can still use the code to register.',
        data: {
          code,
          invitation: {
            id: invitation._id,
            code: invitation.code,
            patientName: invitation.patientName,
            patientPhone: invitation.patientPhone,
            patientEmail: invitation.patientEmail,
            expiresAt: invitation.expiresAt
          }
        },
        deliveryResults: results
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Invitación enviada exitosamente',
      data: {
        code,
        invitation: {
          id: invitation._id,
          code: invitation.code,
          patientName: invitation.patientName,
          patientPhone: invitation.patientPhone,
          patientEmail: invitation.patientEmail,
          expiresAt: invitation.expiresAt,
          // Registration link for easy sharing
          registrationUrl: `${process.env.APP_URL || 'http://localhost:5173'}/register/${code}`
        },
        deliveryResults: results
      }
    });
    
  } catch (error) {
    console.error('Send invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar la invitación',
      error: error.message
    });
  }
};

/**
 * Verify invitation code
 * GET /api/invitations/verify/:code
 */
export const verifyInvitation = async (req, res) => {
  try {
    const { code } = req.params;
    
    console.log('🔍 Verifying invitation code:', code);
    
    const invitation = await Invitation.findValidByCode(code);
    
    if (!invitation) {
      console.log('❌ Invitation not found or expired:', code);
      return res.status(404).json({
        success: false,
        message: 'Código de invitación inválido o expirado'
      });
    }
    
    console.log('✅ Invitation valid:', {
      code: invitation.code,
      patientName: invitation.patientName,
      expiresAt: invitation.expiresAt
    });
    
    const professional = invitation.professionalId || null;
    const professionalName = professional ? `${professional.nombre || ''} ${professional.apellido || ''}`.trim() : null;
    const professionalEmail = professional ? (professional.email || null) : null;

    res.json({
      success: true,
      data: {
        code: invitation.code,
        patientName: invitation.patientName,
        professionalName,
        professionalEmail,
        expiresAt: invitation.expiresAt,
        // include any prefilled patient data if available
        patientData: invitation.patientData || null
      }
    });
    
  } catch (error) {
    console.error('Verify invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar el código',
      error: error.message
    });
  }
};

/**
 * Get all invitations for a professional
 * GET /api/invitations
 */
export const getInvitations = async (req, res) => {
  try {
    const professionalId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = { professionalId };
    if (status) {
      query.status = status;
    }
    
    const skip = (page - 1) * limit;
    
    const [invitations, total] = await Promise.all([
      Invitation.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-logs'),
      Invitation.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        invitations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las invitaciones',
      error: error.message
    });
  }
};

/**
 * Get single invitation with logs
 * GET /api/invitations/:id
 */
export const getInvitationById = async (req, res) => {
  try {
    const { id } = req.params;
    const professionalId = req.user.id;
    
    const invitation = await Invitation.findOne({
      _id: id,
      professionalId
    }).populate('professionalId', 'nombre apellido email');
    
    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitación no encontrada'
      });
    }
    
    res.json({
      success: true,
      data: invitation
    });
    
  } catch (error) {
    console.error('Get invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la invitación',
      error: error.message
    });
  }
};

/**
 * Cancel invitation
 * PUT /api/invitations/:id/cancel
 */
export const cancelInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    const professionalId = req.user.id;
    
    const invitation = await Invitation.findOne({
      _id: id,
      professionalId,
      status: 'pending'
    });
    
    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitación no encontrada o ya no está pendiente'
      });
    }
    
    invitation.status = 'cancelled';
    await invitation.save();
    
    res.json({
      success: true,
      message: 'Invitación cancelada exitosamente'
    });
    
  } catch (error) {
    console.error('Cancel invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar la invitación',
      error: error.message
    });
  }
};

/**
 * Resend invitation
 * POST /api/invitations/:id/resend
 */
export const resendInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    const { channels } = req.body;
    const professionalId = req.user.id;
    
    const invitation = await Invitation.findOne({
      _id: id,
      professionalId,
      status: 'pending'
    }).populate('professionalId', 'nombre apellido');
    
    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitación no encontrada o ya no está pendiente'
      });
    }
    
    // Check if expired
    if (!invitation.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'La invitación ha expirado'
      });
    }
    
    const channelsToUse = channels || invitation.channels;
    const professionalName = `${invitation.professionalId.nombre} ${invitation.professionalId.apellido}`;
    
    const results = [];
    
    // Resend via selected channels
    if (channelsToUse.includes('SMS') && invitation.patientPhone) {
      const formattedPhone = twilioService.formatPhoneNumber(invitation.patientPhone);
      const smsResult = await twilioService.sendInvitationSMS(
        formattedPhone,
        invitation.patientName,
        invitation.code,
        professionalName,
        invitation.customMessage
      );
      
      invitation.logs.push({
        channel: 'SMS',
        status: smsResult.success ? 'sent' : 'failed',
        providerId: smsResult.messageId,
        providerStatus: smsResult.status,
        errorMessage: smsResult.error
      });
      
      results.push({ channel: 'SMS', ...smsResult });
    }
    
    if (channelsToUse.includes('EMAIL') && invitation.patientEmail) {
      const emailResult = await emailService.sendInvitationEmail(
        invitation.patientEmail,
        invitation.patientName,
        invitation.code,
        professionalName,
        invitation.customMessage
      );
      
      invitation.logs.push({
        channel: 'EMAIL',
        status: emailResult.success ? 'sent' : 'failed',
        providerId: emailResult.messageId,
        errorMessage: emailResult.error
      });
      
      results.push({ channel: 'EMAIL', ...emailResult });
    }
    
    await invitation.save();
    
    res.json({
      success: true,
      message: 'Invitación reenviada',
      results
    });
    
  } catch (error) {
    console.error('Resend invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reenviar la invitación',
      error: error.message
    });
  }
};

/**
 * Get invitation statistics for professional
 * GET /api/invitations/stats
 */
export const getInvitationStats = async (req, res) => {
  try {
    const professionalId = req.user.id;
    
    const stats = await Invitation.aggregate([
      { $match: { professionalId: professionalId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const statsObj = {
      total: 0,
      pending: 0,
      registered: 0,
      expired: 0,
      cancelled: 0
    };
    
    stats.forEach(stat => {
      statsObj[stat._id] = stat.count;
      statsObj.total += stat.count;
    });
    
    res.json({
      success: true,
      data: statsObj
    });
    
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};
