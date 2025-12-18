import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  datosPersonales: {
    fechaNacimiento: Date,
    edad: Number,
    genero: String,
    telefono: String,
    direccion: {
      calle: String,
      ciudad: String,
      estado: String,
      codigoPostal: String
    }
  },
  contactoEmergencia: {
    nombre: String,
    relacion: String,
    telefono: String
  },
  historialMedico: {
    alergias: [String],
    medicamentosActuales: [String],
    condicionesMedicas: [String],
    cirugiasPrevias: [String]
  },
  historialPsicologico: {
    diagnosticosPrevios: [String],
    terapiasPrevias: [String],
    motivoConsulta: String,
    objetivosTerapeuticos: [String]
  },
  seguro: {
    tieneSeguro: Boolean,
    aseguradora: String,
    numeroPoliza: String,
    vigencia: Date
  },
  consentimientos: {
    tratamientoDatos: {
      aceptado: Boolean,
      fecha: Date
    },
    terminosCondiciones: {
      aceptado: Boolean,
      fecha: Date
    }
  },
  profesionalAsignado: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Professional',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Professional',
    required: true
  },
  estadoCuenta: {
    saldoPendiente: Number,
    ultimoPago: Date
  },
  activo: {
    type: Boolean,
    default: true
  },
  foto: String,
  documentos: [String],
  diaryNotes: [
    {
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Professional'
      },
      text: { type: String, required: true },
      date: { type: Date, default: Date.now },
      author: { type: String }
    }
  ]
}, {
  timestamps: true
});

export const Patient = mongoose.model('Patient', patientSchema);
