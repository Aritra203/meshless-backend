import mongoose from 'mongoose';

const usageLogSchema = new mongoose.Schema({
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  consumer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  code: { type: mongoose.Schema.Types.ObjectId, ref: 'AccessCode', required: true, index: true },
  bytes: { type: Number, required: true },
  direction: { type: String, enum: ['download'], default: 'download' },
  reportedBy: { type: String, enum: ['gateway', 'manual', 'simulator'], default: 'gateway' },
  meta: { type: Object, default: {} }
}, { timestamps: true });

export const UsageLog = mongoose.model('UsageLog', usageLogSchema);
