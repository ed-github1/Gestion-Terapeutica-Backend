import { Appointment } from '../models/appointment.js';
import { Availability } from '../models/availability.js';
import { Patient } from '../models/patient.js';

// GET /appointments/available-slots
export const getAvailableSlots = async (req, res) => {
  try {
    const { date, professionalId } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, message: 'La fecha es requerida' });
    }

    // Get day of week from date (0 = Sunday, 1 = Monday, ...)
    const requestedDate = new Date(date);
    const dayOfWeek = requestedDate.getDay(); // 0-6

    // Get professional's availability
    const profId = professionalId || req.user.professionalId || req.user.id;
    const availability = await Availability.findOne({ professionalId: profId });

    // Default schedule (Monday-Friday, 9am-4pm)
    const defaultSchedule = {
      "1": ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'],
      "2": ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'],
      "3": ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'],
      "4": ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'],
      "5": ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30']
    };

    // Find slots for this day
    let daySlots;
    if (!availability || !availability.slots || availability.slots.size === 0) {
      // Use default schedule
      daySlots = defaultSchedule[dayOfWeek.toString()] || [];
    } else {
      daySlots = availability.slots.get(dayOfWeek.toString()) || [];
    }

    if (!daySlots || daySlots.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Get already booked appointments for this date
    const bookedAppointments = await Appointment.find({
      professionalId: profId,
      date: {
        $gte: new Date(date + 'T00:00:00.000Z'),
        $lt: new Date(date + 'T23:59:59.999Z')
      },
      status: { $in: ['reserved', 'scheduled', 'confirmed'] }
    });

    const bookedTimes = bookedAppointments.map(appt => appt.time);

    // Build available slots
    const slots = daySlots.map(time => ({
      time,
      available: !bookedTimes.includes(time),
      professionalId: profId
    }));

    res.status(200).json({ success: true, data: slots });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener slots disponibles', error: error.message });
  }
};

// POST /appointments/reserve
export const reserveAppointment = async (req, res) => {
  try {
    console.log('📅 Reserve appointment request:', req.body);
    console.log('👤 User:', { id: req.user.id, role: req.user.role });
    
    // Get patient's assigned professional
    const patient = await Patient.findOne({ userId: req.user.id });
    if (!patient || !patient.profesionalAsignado) {
      return res.status(400).json({ 
        success: false, 
        message: 'No tienes un profesional asignado. Contacta al administrador.' 
      });
    }
    
    const professionalId = req.body.professionalId || patient.profesionalAsignado;
    
    const appt = await Appointment.create({ 
      ...req.body, 
      patientId: req.user.id,
      patientName: `${req.user.nombre} ${req.user.apellido}`,
      professionalId,
      status: 'reserved' 
    });
    console.log('✅ Appointment reserved:', appt._id);
    
    // Populate and format response
    const populated = await Appointment.findById(appt._id)
      .populate('patientId', 'nombre apellido email')
      .populate('professionalId', 'nombre apellido email');
    
    res.status(201).json({ success: true, message: 'Cita reservada exitosamente', data: populated });
  } catch (error) {
    console.error('❌ Error reserving appointment:', error);
    res.status(400).json({ success: false, message: 'Error al reservar cita', error: error.message });
  }
};

// POST /appointments
export const createAppointment = async (req, res) => {
  try {
    const appt = await Appointment.create(req.body);
    res.status(201).json({ success: true, message: 'Cita creada exitosamente', data: appt });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error al crear cita', error: error.message });
  }
};

// GET /appointments
export const getAppointments = async (req, res) => {
  try {
    const query = { ...req.query };
    const appts = await Appointment.find(query)
      .populate('patientId', 'nombre apellido email')
      .populate('professionalId', 'nombre apellido email');
    
    // Format response to include patient name
    const formatted = appts.map(appt => {
      const obj = appt.toObject();
      if (obj.patientId) {
        obj.patientName = `${obj.patientId.nombre} ${obj.patientId.apellido}`;
      }
      if (obj.professionalId) {
        obj.professionalName = `${obj.professionalId.nombre} ${obj.professionalId.apellido}`;
      }
      return obj;
    });
    
    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error al obtener citas', error: error.message });
  }
};

// GET /appointments/:id
export const getAppointmentById = async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id)
      .populate('patientId', 'nombre apellido email')
      .populate('professionalId', 'nombre apellido email');
    
    if (!appt) return res.status(404).json({ success: false, message: 'Cita no encontrada' });
    
    const obj = appt.toObject();
    if (obj.patientId) {
      obj.patientName = `${obj.patientId.nombre} ${obj.patientId.apellido}`;
    }
    if (obj.professionalId) {
      obj.professionalName = `${obj.professionalId.nombre} ${obj.professionalId.apellido}`;
    }
    
    res.status(200).json({ success: true, data: obj });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error al obtener cita', error: error.message });
  }
};

// PUT /appointments/:id
export const updateAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!appt) return res.status(404).json({ success: false, message: 'Cita no encontrada' });
    res.status(200).json({ success: true, data: appt });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error al actualizar cita', error: error.message });
  }
};

// PUT /appointments/:id/cancel
export const cancelAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndUpdate(req.params.id, { status: 'cancelled', cancellationReason: req.body.reason }, { new: true });
    if (!appt) return res.status(404).json({ success: false, message: 'Cita no encontrada' });
    res.status(200).json({ success: true, message: 'Cita cancelada exitosamente', data: appt });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error al cancelar cita', error: error.message });
  }
};

// PUT /appointments/:id/confirm
export const confirmAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndUpdate(req.params.id, { status: 'confirmed' }, { new: true });
    if (!appt) return res.status(404).json({ success: false, message: 'Cita no encontrada' });
    res.status(200).json({ success: true, message: 'Cita confirmada', data: appt });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error al confirmar cita', error: error.message });
  }
};

// PUT /appointments/:id/complete
export const completeAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndUpdate(req.params.id, { status: 'completed', notes: req.body.notes }, { new: true });
    if (!appt) return res.status(404).json({ success: false, message: 'Cita no encontrada' });
    res.status(200).json({ success: true, message: 'Cita completada', data: appt });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error al completar cita', error: error.message });
  }
};

// PUT /appointments/:id/reschedule
export const rescheduleAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndUpdate(req.params.id, { date: req.body.date, time: req.body.time }, { new: true });
    if (!appt) return res.status(404).json({ success: false, message: 'Cita no encontrada' });
    res.status(200).json({ success: true, message: 'Cita reprogramada', data: appt });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error al reprogramar cita', error: error.message });
  }
};

// DELETE /appointments/:id
export const deleteAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndDelete(req.params.id);
    if (!appt) return res.status(404).json({ success: false, message: 'Cita no encontrada' });
    res.status(200).json({ success: true, message: 'Cita eliminada' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error al eliminar cita', error: error.message });
  }
};

// POST /appointments/:id/send-video-link
export const sendVideoLink = async (req, res) => {
  // TODO: Implement video link notification
  res.status(200).json({ success: true, message: 'Enlace enviado por SMS/Email' });
};

// GET /appointments/statistics
export const getStatistics = async (req, res) => {
  // TODO: Implement statistics logic
  res.status(200).json({ success: true, data: {} });
};

// GET /appointments/upcoming
export const getUpcomingAppointments = async (req, res) => {
  // TODO: Implement upcoming appointments logic
  res.status(200).json({ success: true, data: [] });
};
