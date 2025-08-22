import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  providerId: { type: String, required: true },
  consumerId: { type: String, required: true },
  title: { type: String, default: 'Internet Sharing Session' },
  description: { type: String, default: 'High-speed internet sharing' },
  maxBandwidth: { type: String, default: '50 Mbps' },
  availableBandwidth: { type: String },
  pricePerHour: { type: Number, default: 5 },
  duration: { type: Number, default: 2 }, // hours (for planned duration)
  maxUsers: { type: Number, default: 3 },
  connectedUsers: [{ type: String }], // array of user IDs
  location: { type: String, default: 'Location not specified' },
  signalStrength: { type: Number, default: 85 },
  startTime: { type: Date, default: Date.now },
  endTime: Date,
  bytesTransferred: { type: Number, default: 0 },
  actualDuration: { type: Number, default: 0 }, // seconds (actual duration)
  quality: {
    avgLatency: Number, // ms
    avgBandwidth: Number, // Mbps
    uptime: Number, // percentage
  },
  status: { 
    type: String, 
    enum: ['active', 'completed', 'failed', 'terminated', 'paused', 'ended', 'pending'], 
    default: 'active' 
  },
  rewardAmount: { type: Number, default: 0 },
  rewardPaid: { type: Boolean, default: false },
  txHash: String, // blockchain transaction hash
}, { timestamps: true });

export const Session = mongoose.model('Session', SessionSchema);
