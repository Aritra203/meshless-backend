import { Router } from 'express';
import { auth, requireRole } from '../middleware/auth.js';
import { redeemCode, balance } from '../controllers/consumerController.js';
const router = Router();
router.post('/redeem', auth, requireRole('consumer','admin','provider'), redeemCode);
router.get('/balance', auth, requireRole('consumer','admin','provider'), balance);
export default router;
