import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB() {
  mongoose.set('strictQuery', true);
  
  // Updated connection options compatible with latest MongoDB driver
  const mongooseOptions = {
    autoIndex: true,
    serverSelectionTimeoutMS: 30000, // 30 seconds
    socketTimeoutMS: 45000, // 45 seconds
    connectTimeoutMS: 30000, // 30 seconds
    family: 4, // Use IPv4, skip trying IPv6
    retryWrites: true,
    w: 'majority',
    maxPoolSize: 10, // Maintain up to 10 socket connections
    minPoolSize: 2, // Maintain minimum 2 connections
    maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
    heartbeatFrequencyMS: 10000 // Send a ping every 10 seconds
  };

  try {
    console.log('🔌 Attempting MongoDB connection...');
    await mongoose.connect(env.MONGODB_URI, mongooseOptions);
    console.log('✅ MongoDB connected successfully');
    
    // Listen for connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
    
    // Don't exit process in production, let Render handle restarts
    if (env.NODE_ENV !== 'production') {
      process.exit(1);
    }
    throw error;
  }
}
