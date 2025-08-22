// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MeshCredits
 * @dev Simple ERC20-like token for rewarding mesh network participants
 * Deployed on Polygon Mumbai testnet for hackathon demo
 */
contract MeshCredits {
    string public name = "Mesh Network Credits";
    string public symbol = "MESH";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    
    mapping(address => uint256) private balances;
    mapping(address => mapping(address => uint256)) private allowances;
    
    address public owner;
    address public rewardManager; // Backend service that can issue rewards
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Reward(address indexed user, uint256 amount, string reason);
    event RewardManagerChanged(address indexed oldManager, address indexed newManager);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier onlyRewardManager() {
        require(msg.sender == rewardManager, "Only reward manager can call this function");
        _;
    }
    
    constructor(uint256 _initialSupply) {
        owner = msg.sender;
        rewardManager = msg.sender; // Initially, owner is the reward manager
        totalSupply = _initialSupply * 10**decimals;
        balances[owner] = totalSupply;
        emit Transfer(address(0), owner, totalSupply);
    }
    
    function balanceOf(address account) public view returns (uint256) {
        return balances[account];
    }
    
    function getBalance(address account) external view returns (uint256) {
        return balances[account];
    }
    
    function transfer(address to, uint256 amount) public returns (bool) {
        require(to != address(0), "Transfer to zero address");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        balances[msg.sender] -= amount;
        balances[to] += amount;
        
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    function allowance(address owner, address spender) public view returns (uint256) {
        return allowances[owner][spender];
    }
    
    function approve(address spender, uint256 amount) public returns (bool) {
        allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        require(to != address(0), "Transfer to zero address");
        require(balances[from] >= amount, "Insufficient balance");
        require(allowances[from][msg.sender] >= amount, "Insufficient allowance");
        
        balances[from] -= amount;
        balances[to] += amount;
        allowances[from][msg.sender] -= amount;
        
        emit Transfer(from, to, amount);
        return true;
    }
    
    /**
     * @dev Reward a user for sharing internet/bandwidth
     * Only callable by the reward manager (backend service)
     */
    function rewardUser(address user, uint256 amount) external onlyRewardManager {
        require(user != address(0), "Cannot reward zero address");
        require(amount > 0, "Reward amount must be positive");
        
        // Mint new tokens as rewards (inflationary model)
        totalSupply += amount;
        balances[user] += amount;
        
        emit Transfer(address(0), user, amount);
        emit Reward(user, amount, "Bandwidth sharing reward");
    }
    
    /**
     * @dev Reward user with custom reason
     */
    function rewardUserWithReason(address user, uint256 amount, string calldata reason) external onlyRewardManager {
        require(user != address(0), "Cannot reward zero address");
        require(amount > 0, "Reward amount must be positive");
        
        totalSupply += amount;
        balances[user] += amount;
        
        emit Transfer(address(0), user, amount);
        emit Reward(user, amount, reason);
    }
    
    /**
     * @dev Set new reward manager (backend service address)
     */
    function setRewardManager(address newManager) external onlyOwner {
        require(newManager != address(0), "Invalid manager address");
        address oldManager = rewardManager;
        rewardManager = newManager;
        emit RewardManagerChanged(oldManager, newManager);
    }
    
    /**
     * @dev Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner address");
        owner = newOwner;
    }
    
    /**
     * @dev Get contract stats for dashboard
     */
    function getStats() external view returns (
        uint256 _totalSupply,
        uint256 _totalHolders,
        address _owner,
        address _rewardManager
    ) {
        // Note: totalHolders would need to be tracked separately for gas efficiency
        return (totalSupply, 0, owner, rewardManager);
    }
    
    /**
     * @dev Emergency function to pause rewards (if needed)
     */
    function emergencyPause() external onlyOwner {
        rewardManager = address(0);
    }
}
