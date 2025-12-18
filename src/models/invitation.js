import mongoose from 'mongoose';

const invitationLogSchema = new mongoose.Schema({
  channel: {
    type: String,
    enum: ['SMS', 'EMAIL', 'WHATSAPP'],
    required: true
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'failed', 'bounced'],
    required: true
  },
  providerId: String, // Twilio message SID or email message ID
  providerStatus: String,
  errorMessage: String,
  sentAt: {
    type: Date,
    default: Date.now
  },
  deliveredAt: Date
}, {
  timestamps: true
});

const invitationSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  professionalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Professional',
    required: true,
    index: true
  },
  patientName: {
    type: String,
    required: true
  },
  patientEmail: {
    type: String,
    lowercase: true,
    trim: true
  },
  patientPhone: {
    type: String,
    trim: true
  },
  // Extended patient data for pre-filled registration
  patientData: {
    nombre: String,
    apellido: String,
    phone: String,
    dateOfBirth: Date,
    gender: {
      type: String,
      enum: ['male', 'female', 'other']
    },
    address: String,
    emergencyContact: String,
    emergencyPhone: String,
    medicalHistory: String,
    allergies: String,
    currentMedications: String,
    invitationEmail: String
  },
  customMessage: String,
  channels: [{
    type: String,
    enum: ['SMS', 'EMAIL', 'WHATSAPP']
  }],
  status: {
    type: String,
    enum: ['pending', 'registered', 'expired', 'cancelled'],
    default: 'pending',
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  usedAt: Date,
  logs: [invitationLogSchema]
}, {
  timestamps: true
});

// Add index for cleanup of expired invitations
invitationSchema.index({ expiresAt: 1, status: 1 });

// Method to check if invitation is valid
invitationSchema.methods.isValid = function() {
  return this.status === 'pending' && new Date() < this.expiresAt;
};

// Method to mark as used
invitationSchema.methods.markAsUsed = async function() {
  this.status = 'registered';
  this.usedAt = new Date();
  return await this.save();
};

// Static method to find valid invitation by code
invitationSchema.statics.findValidByCode = async function(code) {
  const invitation = await this.findOne({ 
    code,
    status: 'pending'
  }).populate('professionalId', 'nombre apellido email');
  
  if (!invitation) {
    return null;
  }
  
  if (new Date() > invitation.expiresAt) {
    invitation.status = 'expired';
    await invitation.save();
    return null;
  }
  
  return invitation;
};

export const Invitation = mongoose.model('Invitation', invitationSchema);
