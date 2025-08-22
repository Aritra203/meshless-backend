import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { AccessCode } from '../models/AccessCode.js';
import { generateCode } from '../services/codeService.js';

(async () => {
  await connectDB();
  console.log('Seeding users and demo codes...');

  const adminEmail = env.ADMIN_EMAIL;
  const adminPass = env.ADMIN_PASSWORD;

  const [admin] = await User.find({ email: adminEmail });
  let adminUser = admin;
  if (!adminUser) {
    adminUser = await User.create({
      name: 'Admin',
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPass, 10),
      role: 'admin'
    });
    console.log('Admin created:', adminUser.email);
  } else {
    console.log('Admin exists:', adminUser.email);
  }

  // Demo Provider
  let provider = await User.findOne({ email: 'provider@example.com' });
  if (!provider) {
    provider = await User.create({
      name: 'Provider One',
      email: 'provider@example.com',
      passwordHash: await bcrypt.hash('Provider@123', 10),
      role: 'provider'
    });
    console.log('Provider created:', provider.email);
  }

  // Demo Consumer
  let consumer = await User.findOne({ email: 'consumer@example.com' });
  if (!consumer) {
    consumer = await User.create({
      name: 'Consumer One',
      email: 'consumer@example.com',
      passwordHash: await bcrypt.hash('Consumer@123', 10),
      role: 'consumer'
    });
    console.log('Consumer created:', consumer.email);
  }

  // Create 3 demo codes
  for (let i = 0; i < 3; i++) {
    const code = generateCode();
    await AccessCode.create({
      code,
      provider: provider._id,
      totalMB: 500,
      remainingMB: 500,
      expireAt: new Date(Date.now() + 24*3600*1000)
    });
    console.log('Created code:', code);
  }

  console.log('✅ Seed complete.');
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
