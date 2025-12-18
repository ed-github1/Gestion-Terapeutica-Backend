import mongoose from 'mongoose';

const videoInvitationSchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },
  professionalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  professionalName: {
    type: String,
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  patientName: {
    type: String,
    required: true
  },
  appointmentType: {
    type: String,
    required: true
  },
  appointmentTime: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'expired'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  acceptedAt: {
    type: Date
  },
  declinedAt: {
    type: Date
  },
  declineReason: {
    type: String
  }
}, {
  timestamps: true
});

// Auto-expire invitations using MongoDB TTL index
videoInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for faster queries
videoInvitationSchema.index({ patientId: 1, status: 1 });
videoInvitationSchema.index({ appointmentId: 1 });

export const VideoInvitation = mongoose.model('VideoInvitation', videoInvitationSchema);
