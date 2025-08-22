import { User } from '../models/User.js';

const POINTS_PER_MB = 1; // 1 point per MB shared

export async function awardPoints(providerId, bytes) {
  const mb = bytes / (1024 * 1024);
  const points = Math.floor(mb * POINTS_PER_MB);
  if (points <= 0) return 0;
  const provider = await User.findById(providerId);
  if (!provider) return 0;
  provider.points += points;
  provider.bytesShared += bytes;
  await provider.save();
  return points;
}
