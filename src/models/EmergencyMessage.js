import mongoose from 'mongoose';

const EmergencyMessageSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  fromPeer: { type: String, required: true },
  toPeer: String, // null for broadcast
  content: { type: String, required: true },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'emergency'], 
    default: 'medium' 
  },
  messageType: {
    type: String,
    enum: ['text', 'location', 'sos', 'resource-request', 'status'],
    default: 'text'
  },
  location: {
    lat: Number,
    lng: Number,
  },
  ttl: { type: Number, default: 24 }, // hours
  delivered: { type: Boolean, default: false },
  deliveredAt: Date,
  hops: [{ // for mesh routing
    peerId: String,
    timestamp: Date,
  }],
}, { timestamps: true });

export const EmergencyMessage = mongoose.model('EmergencyMessage', EmergencyMessageSchema);
