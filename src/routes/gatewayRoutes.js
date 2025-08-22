import { Router } from 'express';
import { auth, requireRole } from '../middleware/auth.js';
import { authorizeCode, reportUsage } from '../controllers/gatewayController.js';
const router = Router();
// For security, restrict to provider/admin tokens (representing gateway owners)
router.post('/authorize-code', auth, requireRole('provider','admin'), authorizeCode);
router.post('/report-usage', auth, requireRole('provider','admin'), reportUsage);
export default router;
