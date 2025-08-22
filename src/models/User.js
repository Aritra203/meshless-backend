import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['provider', 'consumer', 'admin'], default: 'consumer', index: true },
  points: { type: Number, default: 0 },
  bytesShared: { type: Number, default: 0 },
  bytesConsumed: { type: Number, default: 0 },
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
