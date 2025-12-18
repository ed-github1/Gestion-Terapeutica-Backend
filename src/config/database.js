import mongoose from 'mongoose';
import { config } from './config.js';

export const connectDB = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('✓ MongoDB conectado exitosamente');
  } catch (error) {
    console.error('✗ Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB desconectado');
});

mongoose.connection.on('error', (err) => {
  console.error('Error en conexión MongoDB:', err);
});
