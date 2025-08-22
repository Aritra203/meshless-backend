import { Router } from 'express';
import { auth, requireRole } from '../middleware/auth.js';
import { redeemCode, balance } from '../controllers/consumerController.js';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import { UsageLog } from '../models/UsageLog.js';

const router = Router();

// Original routes
router.post('/redeem', auth, requireRole('consumer','admin','provider'), redeemCode);
router.get('/balance', auth, requireRole('consumer','admin','provider'), balance);

// Get consumer metrics
router.get('/metrics/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user sessions and calculate metrics
    const sessions = await Session.find({ 
      $or: [
        { consumerId: userId },
        { connectedUsers: userId }
      ]
    }).populate('providerId');

    const usageLogs = await UsageLog.find({ userId });

    // Calculate metrics
    const totalSessions = sessions.length;
    const activeSessions = sessions.filter(s => s.status === 'active').length;
    const totalDataUsed = usageLogs.reduce((sum, log) => sum + (log.dataUsed || 0), 0);
    const totalTokensSpent = usageLogs.reduce((sum, log) => sum + (log.cost || 0), 0);

    // Calculate average session duration
    const completedSessions = sessions.filter(s => s.endedAt);
    const avgDuration = completedSessions.length > 0 
      ? completedSessions.reduce((sum, s) => {
          const duration = new Date(s.endedAt).getTime() - new Date(s.createdAt).getTime();
          return sum + duration;
        }, 0) / completedSessions.length / (1000 * 60) // in minutes
      : 0;

    // Get favorite providers (most used)
    const providerUsage = {};
    sessions.forEach(session => {
      const providerId = session.providerId?.toString();
      if (providerId) {
        providerUsage[providerId] = (providerUsage[providerId] || 0) + 1;
      }
    });

    const favoriteProviders = Object.keys(providerUsage).length;

    // Calculate monthly spending (last 6 months)
    const monthlySpending = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const monthlyLogs = usageLogs.filter(log => {
        const logDate = new Date(log.createdAt);
        return logDate >= startOfMonth && logDate <= endOfMonth;
      });
      
      const monthlyTotal = monthlyLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
      monthlySpending.push(monthlyTotal);
    }

    // Calculate daily usage for current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const dailyUsage = [];
    
    for (let i = 1; i <= now.getDate(); i++) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), i);
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), i + 1);
      
      const dayLogs = usageLogs.filter(log => {
        const logDate = new Date(log.createdAt);
        return logDate >= dayStart && logDate < dayEnd;
      });
      
      const dayData = dayLogs.reduce((sum, log) => sum + (log.dataUsed || 0), 0);
      const dayCost = dayLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
      
      dailyUsage.push({
        date: dayStart.toISOString().split('T')[0],
        data: dayData,
        cost: dayCost
      });
    }

    const metrics = {
      totalDataUsed: `${(totalDataUsed / (1024 * 1024 * 1024)).toFixed(2)} GB`,
      totalTokensSpent,
      sessionsJoined: totalSessions,
      averageSessionDuration: `${Math.round(avgDuration)}m`,
      favoriteProviders,
      currentMonthSpending: monthlySpending[monthlySpending.length - 1] || 0,
      dataUsageThisMonth: dailyUsage.reduce((sum, day) => sum + day.data, 0),
      averageSpeed: "50 Mbps", // TODO: Calculate from session data
      reliabilityScore: Math.max(85, Math.min(100, 95 - (totalSessions - activeSessions) * 2)),
      monthlySpending,
      dailyUsage
    };

    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get consumer sessions
router.get('/sessions/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, status } = req.query;
    
    let query = {
      $or: [
        { consumerId: userId },
        { connectedUsers: userId }
      ]
    };
    
    if (status) {
      query.status = status;
    }
    
    const sessions = await Session.find(query)
      .populate('providerId', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const formattedSessions = sessions.map(session => ({
      id: session.sessionId,
      providerName: session.providerId?.name || 'Unknown Provider',
      sessionTitle: session.title || 'Internet Session',
      joinedAt: session.createdAt,
      leftAt: session.endedAt,
      dataUsed: session.dataTransferred ? `${(session.dataTransferred / (1024 * 1024)).toFixed(2)} MB` : '0 MB',
      tokensSpent: session.costPaid || 0,
      averageSpeed: session.averageSpeed || '0 Mbps',
      quality: session.quality || 'good',
      status: session.status
    }));

    res.json({
      success: true,
      sessions: formattedSessions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get consumer rewards history
router.get('/rewards/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;
    
    // Get usage logs that include rewards/payments
    const rewardLogs = await UsageLog.find({ 
      userId,
      $or: [
        { rewardEarned: { $gt: 0 } },
        { cost: { $gt: 0 } }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

    const rewards = rewardLogs.map(log => ({
      id: log._id,
      type: log.rewardEarned > 0 ? 'earned' : 'spent',
      amount: log.rewardEarned || log.cost,
      description: log.description || (log.rewardEarned > 0 ? 'Reward earned' : 'Tokens spent'),
      timestamp: log.createdAt,
      sessionId: log.sessionId
    }));

    const totalEarned = rewardLogs.reduce((sum, log) => sum + (log.rewardEarned || 0), 0);
    const totalSpent = rewardLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
    
    res.json({
      success: true,
      rewards,
      summary: {
        totalEarned,
        totalSpent,
        netBalance: totalEarned - totalSpent
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
