import mongoose from 'mongoose';

const availabilitySchema = new mongoose.Schema({
  professionalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  slots: {
    type: Map,
    of: [String], // e.g. { "1": ["09:00", "09:30"], "2": ["10:00"] }
    default: {}
  }
}, { timestamps: true });

export const Availability = mongoose.model('Availability', availabilitySchema);
