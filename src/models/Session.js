import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  providerId: { type: String, required: true },
  consumerId: { type: String, required: true },
  startTime: { type: Date, default: Date.now },
  endTime: Date,
  bytesTransferred: { type: Number, default: 0 },
  duration: { type: Number, default: 0 }, // seconds
  quality: {
    avgLatency: Number, // ms
    avgBandwidth: Number, // Mbps
    uptime: Number, // percentage
  },
  status: { 
    type: String, 
    enum: ['active', 'completed', 'failed', 'terminated'], 
    default: 'active' 
  },
  rewardAmount: { type: Number, default: 0 },
  rewardPaid: { type: Boolean, default: false },
  txHash: String, // blockchain transaction hash
}, { timestamps: true });

export const Session = mongoose.model('Session', SessionSchema);
