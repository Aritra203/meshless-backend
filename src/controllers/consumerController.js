import { AccessCode } from '../models/AccessCode.js';
import { User } from '../models/User.js';

export async function redeemCode(req, res) {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'code required' });
    const doc = await AccessCode.findOne({ code });
    if (!doc || !doc.isActive) return res.status(404).json({ error: 'Invalid code' });
    if (doc.redeemedBy && doc.redeemedBy.toString() !== req.user._id.toString()) {
      return res.status(400).json({ error: 'Code already redeemed by another user' });
    }
    if (doc.expireAt && doc.expireAt < new Date()) return res.status(400).json({ error: 'Code expired' });
    doc.redeemedBy = req.user._id;
    await doc.save();
    return res.json({ code: doc.code, totalMB: doc.totalMB, remainingMB: doc.remainingMB });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to redeem code' });
  }
}

export async function balance(req, res) {
  const codes = await AccessCode.find({ redeemedBy: req.user._id, isActive: true }).lean();
  const remaining = codes.reduce((a, c) => a + c.remainingMB, 0);
  const user = await User.findById(req.user._id);
  return res.json({ remainingMB: remaining, codes, bytesConsumed: user?.bytesConsumed || 0 });
}
