import { Router } from 'express';
import { auth, requireRole } from '../middleware/auth.js';
import { createCodes, listCodes, usageDashboard } from '../controllers/providerController.js';
const router = Router();
router.post('/codes', auth, requireRole('provider','admin'), createCodes);
router.get('/codes', auth, requireRole('provider','admin'), listCodes);
router.get('/usage', auth, requireRole('provider','admin'), usageDashboard);
export default router;
