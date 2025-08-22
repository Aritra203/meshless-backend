import { User } from '../models/User.js';

export async function leaderboard(req, res) {
  const topProviders = await User.find({ role: 'provider' }).sort({ points: -1 }).limit(20).select('name points bytesShared').lean();
  return res.json({ topProviders });
}
