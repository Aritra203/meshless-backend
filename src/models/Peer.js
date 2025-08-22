import mongoose from 'mongoose';

const PeerSchema = new mongoose.Schema({
  peerId: { type: String, required: true, unique: true },
  walletAddress: { type: String, required: true },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  capabilities: {
    canProvideInternet: { type: Boolean, default: false },
    canReceiveInternet: { type: Boolean, default: true },
    bandwidth: { type: Number, default: 0 }, // Mbps
    latency: { type: Number, default: 0 }, // ms
  },
  location: {
    lat: Number,
    lng: Number,
    city: String,
    country: String,
  },
  reputation: { type: Number, default: 0 },
  totalDataShared: { type: Number, default: 0 }, // bytes
  totalDataConsumed: { type: Number, default: 0 }, // bytes
  tokens: { type: Number, default: 0 },
}, { timestamps: true });

export const Peer = mongoose.model('Peer', PeerSchema);
