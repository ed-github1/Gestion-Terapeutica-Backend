import mongoose from 'mongoose';

const professionalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  datosPersonales: {
    telefono: String,
    especialidad: String,
    cedulaProfesional: String,
    direccionConsultorio: {
      calle: String,
      ciudad: String,
      estado: String,
      codigoPostal: String
    }
  },
  horarioAtencion: {
    dias: [String], // ['Lunes', 'Martes', etc.]
    horaInicio: String,
    horaFin: String
  },
  tarifas: {
    consultaIndividual: Number,
    consultaPareja: Number,
    consultaFamiliar: Number
  },
  estadisticas: {
    totalPacientes: {
      type: Number,
      default: 0
    },
    pacientesActivos: {
      type: Number,
      default: 0
    },
    totalConsultas: {
      type: Number,
      default: 0
    }
  },
  activo: {
    type: Boolean,
    default: true
  },
  foto: String,
  documentos: [String]
}, {
  timestamps: true
});

// Method to increment patient count
professionalSchema.methods.incrementPatientCount = async function() {
  this.estadisticas.totalPacientes += 1;
  this.estadisticas.pacientesActivos += 1;
  return await this.save();
};

// Method to get active patients count
professionalSchema.methods.updateActivePatients = async function(count) {
  this.estadisticas.pacientesActivos = count;
  return await this.save();
};

export const Professional = mongoose.model('Professional', professionalSchema);
