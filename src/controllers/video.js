import twilio from 'twilio';
import { Appointment } from '../models/appointment.js';
import { VideoInvitation } from '../models/videoInvitation.js';

export const videoToken = (req, res) => {
  const { identity, appointmentId } = req.body;
  const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET } = process.env;

  if (!identity || !appointmentId) {
    return res.status(400).json({
      success: false,
      message: 'identity y appointmentId son requeridos'
    });
  }

  const AccessToken = twilio.jwt.AccessToken;
  const VideoGrant = AccessToken.VideoGrant;

  const token = new AccessToken(
    TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY,
    TWILIO_API_SECRET,
    { identity }
  );

  const videoGrant = new VideoGrant({
    room: `room-${appointmentId}`
  });

  token.addGrant(videoGrant);

  res.json({
    token: token.toJwt(),
    roomName: `room-${appointmentId}`
  });
};

/**
 * Notify a patient that a professional has started a video call
 * POST /api/video/notify-patient
 */
export const notifyPatient = async (req, res) => {
  console.log('notifyPatient called', { body: req.body, user: req.user });
  console.log('[notifyPatient] START req.user:', JSON.stringify(req.user));
  try {
    const { appointmentId, patientId, patientName, professionalName } = req.body;
    const professionalId = req.user.professionalId;

    // Validate required fields
    if (!appointmentId || !patientId) {
      return res.status(400).json({
        success: false,
        error: 'appointmentId and patientId are required'
      });
    }

    // Get appointment details with populated data
    const appointment = await Appointment.findById(appointmentId)
      .populate('professionalId', 'name email')
      .populate('patientId', 'name email phone');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // Verify that the professional reference is valid
    if (!appointment.professionalId) {
      return res.status(500).json({
        success: false,
        error: 'Appointment has invalid professional reference'
      });
    }

    // Verify that the patient reference is valid
    if (!appointment.patientId) {
      return res.status(500).json({
        success: false,
        error: 'Appointment has invalid patient reference'
      });
    }

    // Extra logging for professional authorization check
    console.log('[notifyPatient] BEFORE COMPARISON req.user:', JSON.stringify(req.user));
    console.log('[notifyPatient] Comparing appointment.professionalId:', appointment.professionalId._id?.toString?.() || appointment.professionalId, 'with req.user.professionalId:', professionalId);
    // Verify that the professional making the request owns this appointment
    if (appointment.professionalId._id.toString() !== professionalId) {
      console.warn('[notifyPatient] Professional authorization failed. appointment.professionalId:', appointment.professionalId._id.toString(), 'req.user.professionalId:', professionalId);
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You can only notify patients for your own appointments',
        debug: {
          appointmentProfessionalId: appointment.professionalId._id.toString(),
          userProfessionalId: professionalId
        }
      });
    }

    // Verify that the patient in the request matches the appointment
    if (appointment.patientId._id.toString() !== patientId) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID does not match the appointment'
      });
    }

    // Check if there's already an active invitation for this appointment
    const existingInvitation = await VideoInvitation.findOne({
      appointmentId,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    });

    if (existingInvitation) {
      return res.json({
        success: true,
        message: 'Patient already has an active invitation',
        invitation: existingInvitation
      });
    }

    // Format appointment date and time
    const appointmentDateTime = appointment.date 
      ? `${appointment.date.toISOString().split('T')[0]} ${appointment.time}`
      : appointment.time;

    // Use names from request body (frontend provides them) or fall back to populated data
    const finalProfessionalName = professionalName || 
      (appointment.professionalId && appointment.professionalId.name) || 
      'Professional';
    const finalPatientName = patientName || 
      (appointment.patientId && appointment.patientId.name) || 
      'Patient';

    // Create video call invitation
    const invitation = await VideoInvitation.create({
      appointmentId: appointment._id,
      professionalId: professionalId,
      professionalName: finalProfessionalName,
      patientId: patientId,
      patientName: finalPatientName,
      appointmentType: appointment.type,
      appointmentTime: appointmentDateTime,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60000) // 60 seconds
    });

    // TODO: Send push notification via Firebase, OneSignal, etc.
    // await sendPushNotification(appointment.patientId.deviceToken, {
    //   title: 'Videollamada Entrante',
    //   body: `${appointment.professionalId.name} te está llamando`
    // });

    res.json({
      success: true,
      message: 'Patient notified successfully',
      invitation: {
        id: invitation._id,
        appointmentId: invitation.appointmentId,
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    console.error('Error notifying patient:', error);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    // Log appointment and invitation context if available
    try {
      const { appointmentId, patientId } = req.body;
      const appointment = await Appointment.findById(appointmentId);
      console.error('Appointment context:', appointment);
    } catch (ctxErr) {
      console.error('Error fetching appointment context:', ctxErr);
    }
    res.status(500).json({
      success: false,
      error: 'Error sending notification',
      details: error.message
    });
  }
};

/**
 * Get active video call invitations for the current patient
 * GET /api/video/active-invitations
 */
export const getActiveInvitations = async (req, res) => {
  try {
    const patientId = req.user.id;
    const now = new Date();

    // Find active invitations that haven't expired
    const invitations = await VideoInvitation.find({
      patientId: patientId,
      status: 'pending',
      expiresAt: { $gt: now }
    }).populate('professionalId', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      invitations: invitations.map(inv => ({
        id: inv._id,
        appointmentId: inv.appointmentId,
        professionalName: inv.professionalName,
        professionalId: inv.professionalId,
        appointmentType: inv.appointmentType,
        appointmentTime: inv.appointmentTime,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt
      }))
    });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching invitations',
      details: error.message
    });
  }
};

/**
 * Patient accepts a video call invitation
 * POST /api/video/accept-invitation
 */
export const acceptInvitation = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const patientId = req.user.id;

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        error: 'appointmentId is required'
      });
    }

    // Find the invitation
    const invitation = await VideoInvitation.findOne({
      appointmentId,
      patientId,
      status: 'pending'
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found or already processed'
      });
    }

    // Check if invitation has expired
    if (invitation.expiresAt < new Date()) {
      invitation.status = 'expired';
      await invitation.save();
      
      return res.status(410).json({
        success: false,
        error: 'Invitation has expired'
      });
    }

    // Update invitation status
    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    await invitation.save();

    // TODO: Notify professional that patient is joining
    // await notifyProfessional(appointmentId, 'patient_joining');

    res.json({
      success: true,
      message: 'Invitation accepted',
      invitation: {
        id: invitation._id,
        appointmentId: invitation.appointmentId,
        acceptedAt: invitation.acceptedAt
      }
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Error accepting invitation',
      details: error.message
    });
  }
};

/**
 * Patient declines a video call invitation
 * POST /api/video/decline-invitation
 */
export const declineInvitation = async (req, res) => {
  try {
    const { appointmentId, reason } = req.body;
    const patientId = req.user.id;

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        error: 'appointmentId is required'
      });
    }

    // Find the invitation
    const invitation = await VideoInvitation.findOne({
      appointmentId,
      patientId,
      status: 'pending'
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found or already processed'
      });
    }

    // Update invitation status
    invitation.status = 'declined';
    invitation.declinedAt = new Date();
    invitation.declineReason = reason || 'No reason provided';
    await invitation.save();

    // TODO: Notify professional that patient declined
    // await notifyProfessional(appointmentId, 'patient_declined');

    res.json({
      success: true,
      message: 'Invitation declined',
      invitation: {
        id: invitation._id,
        appointmentId: invitation.appointmentId,
        declinedAt: invitation.declinedAt
      }
    });
  } catch (error) {
    console.error('Error declining invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Error declining invitation',
      details: error.message
    });
  }
};
