import { AccessCode } from '../models/AccessCode.js';
import { UsageLog } from '../models/UsageLog.js';
import { User } from '../models/User.js';
import { awardPoints } from '../services/pointsService.js';

// This endpoint would be called by a captive portal/gateway to check a code's validity
export async function authorizeCode(req, res) {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'code required' });
    const doc = await AccessCode.findOne({ code });
    if (!doc || !doc.isActive) return res.status(404).json({ error: 'Invalid code' });
    if (doc.expireAt && doc.expireAt < new Date()) return res.status(400).json({ error: 'Code expired' });
    return res.json({ ok: true, remainingMB: doc.remainingMB, totalMB: doc.totalMB, redeemedBy: doc.redeemedBy });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to authorize code' });
  }
}

// Gateway reports how many bytes were transferred under a specific code
export async function reportUsage(req, res) {
  try {
    const { code, bytes, consumerId } = req.body;
    if (!code || !bytes || bytes <= 0) return res.status(400).json({ error: 'code and bytes required' });
    const doc = await AccessCode.findOne({ code });
    if (!doc || !doc.isActive) return res.status(404).json({ error: 'Invalid code' });
    if (doc.expireAt && doc.expireAt < new Date()) return res.status(400).json({ error: 'Code expired' });

    const mb = bytes / (1024 * 1024);
    if (doc.remainingMB - mb < -0.01) {
      return res.status(400).json({ error: 'Not enough remaining MB' });
    }

    doc.remainingMB = Math.max(0, doc.remainingMB - mb);
    await doc.save();

    const provider = await User.findById(doc.provider);
    const consumer = consumerId ? await User.findById(consumerId) : (doc.redeemedBy ? await User.findById(doc.redeemedBy) : null);

    // Log usage
    await UsageLog.create({
      provider: provider._id,
      consumer: consumer?._id || null,
      code: doc._id,
      bytes,
      reportedBy: 'gateway',
      meta: { code: doc.code }
    });

    // Update aggregate stats
    if (provider) await awardPoints(provider._id, bytes);
    if (consumer) {
      consumer.bytesConsumed += bytes;
      await consumer.save();
    }

    return res.json({ ok: true, remainingMB: doc.remainingMB });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to report usage' });
  }
}
