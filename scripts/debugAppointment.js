// Usage: node scripts/debugAppointment.js <appointmentId>
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Appointment } from '../src/models/appointment.js';
import { Professional } from '../src/models/professional.js';
import { Patient } from '../src/models/patient.js';

const appointmentId = process.argv[2];
if (!appointmentId) {
  console.error('Usage: node scripts/debugAppointment.js <appointmentId>');
  process.exit(1);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  const appointment = await Appointment.findById(appointmentId)
    .populate('professionalId')
    .populate('patientId');

  if (!appointment) {
    console.error('Appointment not found');
    process.exit(1);
  }

  console.log('Appointment:', appointment);

  if (!appointment.professionalId) {
    console.error('❌ professionalId is missing or invalid');
  } else {
    console.log('✅ professionalId:', appointment.professionalId._id, appointment.professionalId.name || appointment.professionalId.email);
  }

  if (!appointment.patientId) {
    console.error('❌ patientId is missing or invalid');
  } else {
    console.log('✅ patientId:', appointment.patientId._id, appointment.patientId.name || appointment.patientId.email);
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
