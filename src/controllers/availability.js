import { Availability } from '../models/availability.js';

// GET /availability
export const getAvailability = async (req, res) => {
  try {
    const professionalId = req.user.professionalId || req.user.id;
    let availability = await Availability.findOne({ professionalId });
    
    // Return default schedule if not set
    if (!availability || !availability.slots || availability.slots.size === 0) {
      const defaultSchedule = {
        "1": ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'],
        "2": ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'],
        "3": ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'],
        "4": ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'],
        "5": ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30']
      };
      
      return res.status(200).json({ 
        success: true, 
        data: defaultSchedule 
      });
    }
    
    // Convert Map to plain object for JSON response
    const slotsObject = Object.fromEntries(availability.slots);
    
    res.status(200).json({ 
      success: true, 
      data: slotsObject 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener disponibilidad', 
      error: error.message 
    });
  }
};

// PUT /availability
export const updateAvailability = async (req, res) => {
  try {
    const professionalId = req.user.professionalId || req.user.id;
    // Frontend sends schedule directly: { "1": [...], "2": [...] }
    const slots = req.body;
    
    const availability = await Availability.findOneAndUpdate(
      { professionalId },
      { professionalId, slots },
      { new: true, upsert: true }
    );
    
    // Convert Map to plain object for response
    const slotsObject = Object.fromEntries(availability.slots);
    
    res.status(200).json({ 
      success: true, 
      message: 'Disponibilidad actualizada',
      data: slotsObject 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error al actualizar disponibilidad', 
      error: error.message 
    });
  }
};
