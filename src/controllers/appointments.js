import { Appointment } from '../models/appointment.js'
import { Availability } from '../models/availability.js'
import { Patient } from '../models/patient.js'

// GET /appointments/available-slots
export const getAvailableSlots = async (req, res) => {
  try {
    const { date, professionalId } = req.query
    console.log('getAvailableSlots called:', { date, professionalId, user: req.user });

    if (!date) {
      return res
        .status(400)
        .json({ success: false, message: 'La fecha es requerida' })
    }
      // Extra debug: check for patient profile and profesionalAsignado
      if (req.user.role === 'patient' && !professionalId) {
        const patientProfile = await Patient.findOne({ userId: req.user.id });
        if (!patientProfile) {
          console.warn('⚠️ No patient profile found for user:', req.user.id, req.user.email);
        } else if (!patientProfile.profesionalAsignado) {
          console.warn('⚠️ Patient profile found but profesionalAsignado is missing for user:', req.user.id, req.user.email);
        } else {
          console.warn('⚠️ profesionalAsignado exists but was not resolved. Value:', patientProfile.profesionalAsignado);
        }
      }

    // Get day of week from date (0 = Sunday, 1 = Monday, ...)
    const requestedDate = new Date(date)
    const dayOfWeek = requestedDate.getDay() // 0-6
    console.log('Requested date:', requestedDate, 'Day of week:', dayOfWeek);

    // Get professional's availability
    let profId = professionalId;
    if (!profId) {
      if (req.user.role === 'patient') {
        const patient = await Patient.findOne({ userId: req.user.id });
        profId = patient?.profesionalAsignado;
        console.log('Resolved professionalId for patient:', profId);
      } else {
        profId = req.user.professionalId || req.user.id;
      }
    }
    const availability = await Availability.findOne({ professionalId: profId });
    console.log('profId:', profId, 'availability:', availability);


    // Find slots for this day
    let daySlots = [];
    if (
      availability &&
      availability.slots &&
      Object.keys(availability.slots).length > 0
    ) {
      console.log('Raw slots object:', availability.slots);
      console.log('Day key:', dayOfWeek);
      // If slots is a Map (as in your log), use .get()
      if (typeof availability.slots.get === 'function') {
        daySlots = availability.slots.get(dayOfWeek.toString()) || [];
      } else {
        // If slots is a plain object
        daySlots = availability.slots[dayOfWeek.toString()] || [];
      }
      console.log('Day slots for', dayOfWeek, ':', daySlots);
    }

    if (!daySlots || daySlots.length === 0) {
      console.log('No slots found for this day.');
      return res.status(200).json({ success: true, data: [] })
    }

    // Get already booked appointments for this date
    const bookedAppointments = await Appointment.find({
      professionalId: profId,
      date: {
        $gte: new Date(date + 'T00:00:00.000Z'),
        $lt: new Date(date + 'T23:59:59.999Z')
      },
      status: { $in: ['reserved', 'scheduled', 'confirmed'] }
    })
    console.log('Booked appointments:', bookedAppointments);

    const bookedTimes = bookedAppointments.map((appt) => appt.time)
    console.log('Booked times:', bookedTimes);

    // Build available slots
    const slots = daySlots.map((time) => ({
      time,
      available: !bookedTimes.includes(time),
      professionalId: profId
    }))
    console.log('Final available slots:', slots);

    res.status(200).json({ success: true, data: slots })
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: 'Error al obtener slots disponibles',
        error: error.message
      })
  }
}

// POST /appointments/reserve
export const reserveAppointment = async (req, res) => {
  try {
    console.log('📅 Reserve appointment request:', req.body)
    console.log('👤 User:', { id: req.user.id, role: req.user.role })

    // Get patient's assigned professional
    const patient = await Patient.findOne({ userId: req.user.id })
    if (!patient || !patient.profesionalAsignado) {
      return res.status(400).json({
        success: false,
        message: 'No tienes un profesional asignado. Contacta al administrador.'
      })
    }

    // Get the Professional's _id (not User's _id)
    const professionalId = req.body.professionalId || patient.profesionalAsignado;

    const appt = await Appointment.create({
      ...req.body,
      patientId: req.user.id,
      patientName: `${req.user.nombre} ${req.user.apellido}`,
      professionalId,
      status: 'reserved'
    });
    console.log('✅ Appointment reserved:', appt._id);

    // Populate and format response, including professional's user info
    const populated = await Appointment.findById(appt._id)
      .populate('patientId', 'nombre apellido email')
      .populate({ path: 'professionalId', populate: { path: 'userId', select: 'nombre apellido email' } });

    res.status(201).json({
      success: true,
      message: 'Cita reservada exitosamente',
      data: populated
    });
  } catch (error) {
    console.error('❌ Error reserving appointment:', error)
    res
      .status(400)
      .json({
        success: false,
        message: 'Error al reservar cita',
        error: error.message
      })
  }
}

// POST /appointments
export const createAppointment = async (req, res) => {
  try {
    const appt = await Appointment.create(req.body)
    res
      .status(201)
      .json({ success: true, message: 'Cita creada exitosamente', data: appt })
  } catch (error) {
    res
      .status(400)
      .json({
        success: false,
        message: 'Error al crear cita',
        error: error.message
      })
  }
}

// GET /appointments
export const getAppointments = async (req, res) => {
  try {
    const query = { ...req.query }
    console.log('getAppointments called. Query:', query);
    const appts = await Appointment.find(query)
      .populate('patientId', 'nombre apellido email')
      .populate({ path: 'professionalId', populate: { path: 'userId', select: 'nombre apellido email' } });
    console.log('Appointments found:', appts.length);

    // Format response to include patient and professional user name
    const formatted = appts.map((appt) => {
      const obj = appt.toObject();
      if (obj.patientId) {
        obj.patientName = `${obj.patientId.nombre} ${obj.patientId.apellido}`;
      }
      if (obj.professionalId && obj.professionalId.userId) {
        obj.professionalName = `${obj.professionalId.userId.nombre} ${obj.professionalId.userId.apellido}`;
      }
      return obj;
    });

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    res
      .status(400)
      .json({
        success: false,
        message: 'Error al obtener citas',
        error: error.message
      })
  }
}

// GET /appointments/:id
export const getAppointmentById = async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id)
      .populate('patientId', 'nombre apellido email')
      .populate({ path: 'professionalId', populate: { path: 'userId', select: 'nombre apellido email' } });

    if (!appt)
      return res.status(404).json({ success: false, message: 'Cita no encontrada' });

    const obj = appt.toObject();
    if (obj.patientId) {
      obj.patientName = `${obj.patientId.nombre} ${obj.patientId.apellido}`;
    }
    if (obj.professionalId && obj.professionalId.userId) {
      obj.professionalName = `${obj.professionalId.userId.nombre} ${obj.professionalId.userId.apellido}`;
    }

    res.status(200).json({ success: true, data: obj });
  } catch (error) {
    res
      .status(400)
      .json({
        success: false,
        message: 'Error al obtener cita',
        error: error.message
      })
  }
}

// PUT /appointments/:id
export const updateAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndUpdate(req.params.id, req.body, {
      new: true
    })
    if (!appt)
      return res
        .status(404)
        .json({ success: false, message: 'Cita no encontrada' })
    res.status(200).json({ success: true, data: appt })
  } catch (error) {
    res
      .status(400)
      .json({
        success: false,
        message: 'Error al actualizar cita',
        error: error.message
      })
  }
}

// PUT /appointments/:id/cancel
export const cancelAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status: 'cancelled', cancellationReason: req.body.reason },
      { new: true }
    )
    if (!appt)
      return res
        .status(404)
        .json({ success: false, message: 'Cita no encontrada' })
    res
      .status(200)
      .json({
        success: true,
        message: 'Cita cancelada exitosamente',
        data: appt
      })
  } catch (error) {
    res
      .status(400)
      .json({
        success: false,
        message: 'Error al cancelar cita',
        error: error.message
      })
  }
}

// PUT /appointments/:id/confirm
export const confirmAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status: 'confirmed' },
      { new: true }
    )
    if (!appt)
      return res
        .status(404)
        .json({ success: false, message: 'Cita no encontrada' })
    res
      .status(200)
      .json({ success: true, message: 'Cita confirmada', data: appt })
  } catch (error) {
    res
      .status(400)
      .json({
        success: false,
        message: 'Error al confirmar cita',
        error: error.message
      })
  }
}

// PUT /appointments/:id/complete
export const completeAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status: 'completed', notes: req.body.notes },
      { new: true }
    )
    if (!appt)
      return res
        .status(404)
        .json({ success: false, message: 'Cita no encontrada' })
    res
      .status(200)
      .json({ success: true, message: 'Cita completada', data: appt })
  } catch (error) {
    res
      .status(400)
      .json({
        success: false,
        message: 'Error al completar cita',
        error: error.message
      })
  }
}

// PUT /appointments/:id/reschedule
export const rescheduleAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndUpdate(
      req.params.id,
      { date: req.body.date, time: req.body.time },
      { new: true }
    )
    if (!appt)
      return res
        .status(404)
        .json({ success: false, message: 'Cita no encontrada' })
    res
      .status(200)
      .json({ success: true, message: 'Cita reprogramada', data: appt })
  } catch (error) {
    res
      .status(400)
      .json({
        success: false,
        message: 'Error al reprogramar cita',
        error: error.message
      })
  }
}

// DELETE /appointments/:id
export const deleteAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndDelete(req.params.id)
    if (!appt)
      return res
        .status(404)
        .json({ success: false, message: 'Cita no encontrada' })
    res.status(200).json({ success: true, message: 'Cita eliminada' })
  } catch (error) {
    res
      .status(400)
      .json({
        success: false,
        message: 'Error al eliminar cita',
        error: error.message
      })
  }
}

// POST /appointments/:id/send-video-link
export const sendVideoLink = async (req, res) => {
  // TODO: Implement video link notification
  res
    .status(200)
    .json({ success: true, message: 'Enlace enviado por SMS/Email' })
}

// GET /appointments/statistics
export const getStatistics = async (req, res) => {
  // TODO: Implement statistics logic
  res.status(200).json({ success: true, data: {} })
}

// GET /appointments/upcoming
export const getUpcomingAppointments = async (req, res) => {
  // TODO: Implement upcoming appointments logic
  res.status(200).json({ success: true, data: [] })
}
