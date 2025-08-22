import { Router } from 'express';
import { leaderboard } from '../controllers/leaderboardController.js';
const router = Router();
router.get('/', leaderboard);
export default router;
