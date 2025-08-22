# 🔧 MongoDB Connection Fix for Render

## The Problem
You're experiencing SSL/TLS connection errors to MongoDB Atlas from Render:
- `tlsv1 alert internal error`
- Connection resets during handshake

## Solutions

### 1. Update MongoDB Connection String
Ensure your `MONGODB_URI` in Render includes:
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/meshless?retryWrites=true&w=majority&appName=meshless-backend
```

### 2. MongoDB Atlas Network Configuration
1. **Go to MongoDB Atlas Dashboard**
2. **Network Access** → **IP Access List**
3. **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`)
4. Or add Render's specific IP ranges if you prefer

### 3. Database User Permissions
1. **Database Access** → **Database Users**
2. Ensure your user has **Built-in Role: Atlas admin** or **Read and write to any database**

### 4. Connection String Format
Make sure your connection string:
- ✅ Includes the database name: `/meshless`
- ✅ Has the correct cluster URL
- ✅ Uses the right username/password
- ✅ Includes `retryWrites=true&w=majority`

### 5. Environment Variables in Render
In your Render dashboard, set these variables:
```
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/meshless?retryWrites=true&w=majority&appName=meshless-backend
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
```

### 6. Test Connection
After updating, redeploy and check logs for:
```
✅ MongoDB connected successfully
```

## Common Issues

### Password Contains Special Characters
If your MongoDB password contains special characters, URL encode them:
- `@` becomes `%40`
- `#` becomes `%23`
- `!` becomes `%21`

### Cluster Sleep (Free Tier)
MongoDB Atlas free tier clusters may sleep after inactivity. This can cause connection issues.

## Alternative: Create New Cluster
If issues persist:
1. Create a new MongoDB Atlas cluster
2. Create a new database user with simple password (no special characters)
3. Update your `MONGODB_URI` in Render environment variables

---

After making these changes, redeploy your service in Render and monitor the logs!
