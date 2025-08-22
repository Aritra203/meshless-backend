import { ethers } from 'ethers';
import { env } from '../config/env.js';

// Smart contract ABI (for MeshCredits token)
const MESH_CREDITS_ABI = [
  "function rewardUser(address user, uint256 amount) external",
  "function getBalance(address user) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function totalSupply() external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "event Reward(address indexed user, uint256 amount, string reason)"
];

class BlockchainService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.meshCreditsContract = null;
    this.init();
  }

  async init() {
    try {
      // Connect to Polygon Mumbai testnet
      this.provider = new ethers.JsonRpcProvider(env.POLYGON_RPC_URL || 'https://rpc-mumbai.maticvigil.com');
      
      // Create signer from private key
      if (env.BLOCKCHAIN_PRIVATE_KEY) {
        this.signer = new ethers.Wallet(env.BLOCKCHAIN_PRIVATE_KEY, this.provider);
      }

      // Initialize contract
      if (env.MESH_CREDITS_CONTRACT_ADDRESS && this.signer) {
        this.meshCreditsContract = new ethers.Contract(
          env.MESH_CREDITS_CONTRACT_ADDRESS,
          MESH_CREDITS_ABI,
          this.signer
        );
      }

      console.log('✅ Blockchain service initialized');
    } catch (error) {
      console.error('❌ Blockchain service initialization failed:', error.message);
    }
  }

  async rewardUser(userAddress, amount, reason = 'Data sharing') {
    try {
      if (!this.meshCreditsContract) {
        throw new Error('Contract not initialized');
      }

      const tx = await this.meshCreditsContract.rewardUser(
        userAddress,
        ethers.parseEther(amount.toString())
      );

      console.log(`💰 Rewarding ${userAddress} with ${amount} MESH tokens. TX: ${tx.hash}`);
      
      const receipt = await tx.wait();
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      console.error('❌ Reward failed:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getBalance(userAddress) {
    try {
      if (!this.meshCreditsContract) {
        throw new Error('Contract not initialized');
      }

      const balance = await this.meshCreditsContract.getBalance(userAddress);
      return {
        success: true,
        balance: ethers.formatEther(balance),
        balanceWei: balance.toString(),
      };
    } catch (error) {
      console.error('❌ Get balance failed:', error.message);
      return {
        success: false,
        error: error.message,
        balance: '0',
      };
    }
  }

  async estimateReward(bytesShared, qualityScore = 1.0) {
    // Simple reward calculation: 1 MESH per GB shared, with quality multiplier
    const gbShared = bytesShared / (1024 * 1024 * 1024);
    const baseReward = gbShared * 1.0; // 1 MESH per GB
    const finalReward = baseReward * qualityScore;
    
    return Math.max(finalReward, 0.001); // Minimum 0.001 MESH
  }

  async getNetworkStats() {
    try {
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }

      const blockNumber = await this.provider.getBlockNumber();
      const gasPrice = await this.provider.getFeeData();
      
      return {
        success: true,
        blockNumber,
        gasPrice: ethers.formatUnits(gasPrice.gasPrice, 'gwei'),
        network: await this.provider.getNetwork(),
      };
    } catch (error) {
      console.error('❌ Get network stats failed:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export const blockchainService = new BlockchainService();
