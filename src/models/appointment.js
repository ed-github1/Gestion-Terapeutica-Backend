import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  professionalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  patientName: String,
  date: { type: Date, required: true },
  time: { type: String, required: true },
  type: { type: String, enum: ['consultation', 'followup', 'therapy', 'emergency'], required: true },
  duration: Number,
  reason: String,
  notes: String,
  status: { type: String, enum: ['reserved', 'scheduled', 'confirmed', 'completed', 'cancelled'], default: 'reserved' },
  isVideoCall: Boolean,
  paymentStatus: { type: String, enum: ['pending', 'completed', 'refunded'], default: 'pending' },
  cancellationReason: String,
  amount: Number,
}, {
  timestamps: true
});

export const Appointment = mongoose.model('Appointment', appointmentSchema);
