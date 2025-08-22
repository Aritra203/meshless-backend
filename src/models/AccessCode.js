import mongoose from 'mongoose';

const accessCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  totalMB: { type: Number, required: true },
  remainingMB: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  redeemedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  expireAt: { type: Date, default: null },
}, { timestamps: true });

accessCodeSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expireAt: { $type: 'date' } } });

export const AccessCode = mongoose.model('AccessCode', accessCodeSchema);
