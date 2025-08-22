import express from 'express';
import { blockchainService } from '../services/blockchainService.js';
import { Peer } from '../models/Peer.js';
import { Session } from '../models/Session.js';

const router = express.Router();

// Get user's token balance
router.get('/balance/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    const result = await blockchainService.getBalance(walletAddress);
    
    res.json({
      success: result.success,
      balance: result.balance,
      balanceWei: result.balanceWei,
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Manual reward (for testing/admin)
router.post('/reward', async (req, res) => {
  try {
    const { walletAddress, amount, reason } = req.body;
    
    if (!walletAddress || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address and amount are required'
      });
    }
    
    const result = await blockchainService.rewardUser(
      walletAddress, 
      amount, 
      reason || 'Manual reward'
    );
    
    if (result.success) {
      // Update peer's token balance in DB
      await Peer.findOneAndUpdate(
        { walletAddress },
        { $inc: { tokens: amount } }
      );
    }
    
    res.json({
      success: result.success,
      txHash: result.txHash,
      blockNumber: result.blockNumber,
      gasUsed: result.gasUsed,
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Process pending rewards for completed sessions
router.post('/process-rewards', async (req, res) => {
  try {
    const pendingSessions = await Session.find({
      status: 'completed',
      rewardPaid: false,
      rewardAmount: { $gt: 0 }
    }).limit(10); // Process max 10 at a time
    
    const results = [];
    
    for (const session of pendingSessions) {
      const provider = await Peer.findOne({ peerId: session.providerId });
      
      if (provider && provider.walletAddress) {
        const result = await blockchainService.rewardUser(
          provider.walletAddress,
          session.rewardAmount,
          `Session ${session.sessionId}`
        );
        
        if (result.success) {
          session.rewardPaid = true;
          session.txHash = result.txHash;
          await session.save();
          
          // Update peer's token balance
          await Peer.findOneAndUpdate(
            { walletAddress: provider.walletAddress },
            { $inc: { tokens: session.rewardAmount } }
          );
        }
        
        results.push({
          sessionId: session.sessionId,
          providerId: session.providerId,
          amount: session.rewardAmount,
          success: result.success,
          txHash: result.txHash,
          error: result.error
        });
      }
    }
    
    res.json({
      success: true,
      processed: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get network blockchain stats
router.get('/network-stats', async (req, res) => {
  try {
    const networkStats = await blockchainService.getNetworkStats();
    
    res.json({
      success: networkStats.success,
      stats: networkStats.success ? {
        blockNumber: networkStats.blockNumber,
        gasPrice: networkStats.gasPrice,
        network: networkStats.network
      } : null,
      error: networkStats.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get token distribution stats
router.get('/token-stats', async (req, res) => {
  try {
    const totalUsers = await Peer.countDocuments({ walletAddress: { $exists: true } });
    const totalTokensEarned = await Peer.aggregate([
      { $group: { _id: null, total: { $sum: '$tokens' } } }
    ]);
    
    const topEarners = await Peer.find({ tokens: { $gt: 0 } })
      .sort({ tokens: -1 })
      .limit(10)
      .select('peerId walletAddress tokens totalDataShared reputation');
    
    const tokenDistribution = await Peer.aggregate([
      {
        $bucket: {
          groupBy: '$tokens',
          boundaries: [0, 1, 10, 100, 1000, Infinity],
          default: 'Other',
          output: {
            count: { $sum: 1 },
            totalTokens: { $sum: '$tokens' }
          }
        }
      }
    ]);
    
    res.json({
      success: true,
      stats: {
        totalUsers,
        totalTokensEarned: totalTokensEarned[0]?.total || 0,
        topEarners,
        tokenDistribution
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Estimate reward for given usage
router.post('/estimate-reward', async (req, res) => {
  try {
    const { bytesShared, qualityScore = 1.0 } = req.body;
    
    if (!bytesShared || bytesShared < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid bytes shared amount is required'
      });
    }
    
    const estimatedReward = await blockchainService.estimateReward(
      bytesShared, 
      qualityScore
    );
    
    res.json({
      success: true,
      estimate: {
        bytesShared,
        qualityScore,
        rewardAmount: estimatedReward,
        gbShared: bytesShared / (1024 * 1024 * 1024)
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
