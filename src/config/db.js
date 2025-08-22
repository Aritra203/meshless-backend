import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB() {
  mongoose.set('strictQuery', true);
  
  // Enhanced connection options for Render deployment
  const mongooseOptions = {
    autoIndex: true,
    serverSelectionTimeoutMS: 30000, // 30 seconds
    socketTimeoutMS: 45000, // 45 seconds
    family: 4, // Use IPv4, skip trying IPv6
    retryWrites: true,
    w: 'majority',
    maxPoolSize: 10, // Maintain up to 10 socket connections
    bufferCommands: false, // Disable mongoose buffering
    bufferMaxEntries: 0 // Disable mongoose buffering
  };

  try {
    await mongoose.connect(env.MONGODB_URI, mongooseOptions);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    // Don't exit process in production, let Render handle restarts
    if (env.NODE_ENV !== 'production') {
      process.exit(1);
    }
    throw error;
  }
}
