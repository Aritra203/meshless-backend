# 🚀 Deploy Meshless Backend to Render

## Prerequisites
- [x] GitHub account
- [x] MongoDB Atlas account (free tier available)
- [x] Your code pushed to GitHub repository

## Step 1: MongoDB Atlas Setup

1. **Create MongoDB Atlas Account**
   - Visit [MongoDB Atlas](https://cloud.mongodb.com)
   - Sign up for free tier

2. **Create Database Cluster**
   - Click "Build a Database"
   - Choose "FREE" shared cluster
   - Select a cloud provider and region
   - Name your cluster (e.g., "meshless-cluster")

3. **Configure Database Access**
   - Go to "Database Access" 
   - Click "Add New Database User"
   - Create username/password (save these!)
   - Set role to "Atlas admin" or "Read and write to any database"

4. **Configure Network Access**
   - Go to "Network Access"
   - Click "Add IP Address"
   - Select "Allow Access from Anywhere" (0.0.0.0/0)
   - Or specifically add Render's IP ranges

5. **Get Connection String**
   - Go to "Database" → "Connect"
   - Select "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password

## Step 2: Deploy to Render

### Option A: Auto-Deploy with render.yaml (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for Render deployment"
   git push origin main
   ```

2. **Connect to Render**
   - Visit [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your meshless-backend repository

3. **Configure Service**
   - Name: `meshless-backend`
   - Branch: `main`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Render will detect the `render.yaml` file automatically

### Option B: Manual Setup

1. **Create Web Service**
   - Name: `meshless-backend`
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`

## Step 3: Environment Variables

Add these environment variables in Render dashboard:

### Required Variables
```
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/meshless?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
```

### Optional Variables (with defaults)
```
CORS_ORIGIN=*
ADMIN_EMAIL=admin@meshless.network
ADMIN_PASSWORD=SecureAdmin@123
POLYGON_RPC_URL=https://rpc-mumbai.maticvigil.com
MESH_NETWORK_ID=meshless-production
DEFAULT_REWARD_RATE=1.0
MAX_PEER_CONNECTIONS=1000
EMERGENCY_MESSAGE_TTL=24
SOS_BROADCAST_RADIUS=1000
LOG_LEVEL=error
```

### Blockchain Variables (if using)
```
BLOCKCHAIN_PRIVATE_KEY=your-private-key-without-0x-prefix
MESH_CREDITS_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890
```

## Step 4: Deploy

1. **Deploy Service**
   - Click "Create Web Service"
   - Render will automatically build and deploy
   - Monitor logs for any issues

2. **Verify Deployment**
   - Visit your service URL (e.g., `https://meshless-backend-xxxx.onrender.com`)
   - You should see: `{"message":"🌐 Meshless Backend API","status":"online"}`

## Step 5: Test API Endpoints

Test key endpoints:
- `GET /` - Health check
- `POST /api/auth/register` - User registration
- `GET /api/mesh/peers` - Mesh network status
- `GET /api/leaderboard` - Points leaderboard

## Important Notes

### Free Tier Limitations
- Service spins down after 15 minutes of inactivity
- 750 build hours/month
- Services restart on requests after sleeping

### Production Considerations
- Use paid plan for production (no sleep, more resources)
- Set up custom domain
- Configure monitoring and alerts
- Implement proper error handling and logging

### Security
- Never commit `.env` file to Git
- Use strong JWT secrets (32+ characters)
- Regularly rotate API keys and passwords
- Consider IP whitelisting for production

## Troubleshooting

### Common Issues

**Build Fails**
- Check Node.js version compatibility in `package.json`
- Verify all dependencies are listed
- Check for ES modules configuration

**Database Connection Fails**
- Verify MongoDB Atlas IP whitelist includes 0.0.0.0/0
- Check connection string format
- Ensure database user has proper permissions

**Service Won't Start**
- Check environment variables are set correctly
- Review build and deploy logs
- Verify `start` script in `package.json`

### Logs and Debugging
- Use Render dashboard to view real-time logs
- Set `LOG_LEVEL=debug` for verbose logging
- Monitor memory and CPU usage

## Next Steps

1. **Set up monitoring** - Use Render's built-in metrics
2. **Configure alerts** - Set up Slack/email notifications
3. **Add custom domain** - Point your domain to Render service
4. **Scale if needed** - Upgrade to paid plan for production load

---

🎉 **Your Meshless Backend is now live on Render!**

Need help? Check [Render Documentation](https://render.com/docs) or the troubleshooting section above.
