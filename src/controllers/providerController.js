import { AccessCode } from '../models/AccessCode.js';
import { UsageLog } from '../models/UsageLog.js';
import { generateCode } from '../services/codeService.js';

export async function createCodes(req, res) {
  try {
    const { totalMB, count = 1, expireHours = null } = req.body;
    if (!totalMB || totalMB <= 0) return res.status(400).json({ error: 'totalMB must be > 0' });
    if (count > 50) return res.status(400).json({ error: 'count too large (max 50)' });
    const expireAt = expireHours ? new Date(Date.now() + expireHours * 3600 * 1000) : null;
    const docs = [];
    for (let i = 0; i < count; i++) {
      const code = generateCode();
      docs.push({
        code,
        provider: req.user._id,
        totalMB,
        remainingMB: totalMB,
        expireAt,
      });
    }
    const created = await AccessCode.insertMany(docs);
    return res.json({ codes: created.map(c => ({ code: c.code, totalMB: c.totalMB, expireAt: c.expireAt })) });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to create codes' });
  }
}

export async function listCodes(req, res) {
  const codes = await AccessCode.find({ provider: req.user._id }).sort({ createdAt: -1 }).lean();
  return res.json({ codes });
}

export async function usageDashboard(req, res) {
  const logs = await UsageLog.find({ provider: req.user._id }).sort({ createdAt: -1 }).limit(200).lean();
  const agg = logs.reduce((acc, l) => acc + l.bytes, 0);
  return res.json({ totalBytes: agg, logs });
}
