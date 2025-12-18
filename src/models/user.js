import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Por favor ingrese un email válido']
  },
  password: {
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres']
  },
  nombre: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true
  },
  apellido: {
    type: String,
    required: [true, 'El apellido es requerido'],
    trim: true
  },
  role: {
    type: String,
    enum: ['patient', 'professional', 'admin'],
    required: [true, 'El rol es requerido']
  },
  isRegistered: {
    type: Boolean,
    default: false
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Method to sanitize user object (remove password)
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

export const User = mongoose.model('User', userSchema);
