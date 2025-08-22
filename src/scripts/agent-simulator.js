// Simulates a provider gateway reporting usage periodically
import axios from 'axios';

const API_BASE = process.env.API_BASE || 'http://localhost:8080';
const PROVIDER_EMAIL = process.env.PROVIDER_EMAIL || 'provider@example.com';
const PROVIDER_PASSWORD = process.env.PROVIDER_PASSWORD || 'Provider@123';
const SIM_BYTES_PER_TICK = parseInt(process.env.SIM_BYTES_PER_TICK || `${256 * 1024}`); // 256 KB
const TICK_MS = parseInt(process.env.TICK_MS || '1000');
const TARGET_CODE = process.env.TARGET_CODE || null; // if provided, uses this code

async function login() {
  const r = await axios.post(`${API_BASE}/api/auth/login`, { email: PROVIDER_EMAIL, password: PROVIDER_PASSWORD });
  return r.data.token;
}

async function getCodes(token) {
  const r = await axios.get(`${API_BASE}/api/provider/codes`, { headers: { Authorization: `Bearer ${token}` } });
  return r.data.codes;
}

async function createCode(token) {
  const r = await axios.post(`${API_BASE}/api/provider/codes`, { totalMB: 200, count: 1, expireHours: 24 }, { headers: { Authorization: `Bearer ${token}` } });
  return r.data.codes[0].code;
}

async function authorize(token, code) {
  const r = await axios.post(`${API_BASE}/api/gateway/authorize-code`, { code }, { headers: { Authorization: `Bearer ${token}` } });
  return r.data;
}

async function report(token, code, bytes) {
  const r = await axios.post(`${API_BASE}/api/gateway/report-usage`, { code, bytes }, { headers: { Authorization: `Bearer ${token}` } });
  return r.data;
}

(async () => {
  const token = await login();
  let code = TARGET_CODE;
  if (!code) {
    const existing = await getCodes(token);
    code = existing?.[0]?.code || await createCode(token);
  }
  console.log('Using code:', code);
  await authorize(token, code);

  let i = 0;
  // Run for 60 ticks
  const maxTicks = parseInt(process.env.SIM_TICKS || '60');
  const interval = setInterval(async () => {
    try {
      const out = await report(token, code, SIM_BYTES_PER_TICK);
      console.log(`#${++i} reported`, SIM_BYTES_PER_TICK, 'bytes; remainingMB=', out.remainingMB);
      if (i >= maxTicks) {
        clearInterval(interval);
        console.log('Simulator done.');
      }
    } catch (e) {
      console.error('Report failed:', e.response?.data || e.message);
      clearInterval(interval);
    }
  }, TICK_MS);
})();
