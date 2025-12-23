# 🚀 Deployment Guide: Universal Sentinel to Vercel

This guide will help you deploy Universal Sentinel so judges can access it live!

## 📋 Overview

Universal Sentinel has two parts:
1. **Frontend** (React + Vite) → Deploy to **Vercel** ✅
2. **Backend** (FastAPI) → Deploy to **Railway** or **Render** (free tier)

---

## 🎯 Step 1: Prepare Your Code

### 1.1 Ensure Everything is Committed

```bash
cd /Users/amar/Codes/universal-sentinel
git status
git add .
git commit -m "Ready for deployment"
```

### 1.2 Push to GitHub

```bash
git remote -v  # Check if remote exists
# If not, add it:
git remote add origin https://github.com/kushwahaamar-dev/sentinel.git
git push -u origin main
```

---

## 🌐 Step 2: Deploy Backend to Railway (Recommended)

Railway is the easiest way to deploy Python backends for free.

### 2.1 Create Railway Account

1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your `kushwahaamar-dev/sentinel` repository

### 2.2 Configure Backend Service

1. Railway will detect it's a Python project
2. Click on the service → "Settings"
3. Set these environment variables:

```
SENTINEL_MODE=LIVE
GEMINI_API_KEY=your_gemini_key_here
RPC_URL=your_rpc_url (optional)
CONTRACT_ADDRESS=your_contract (optional)
CHAIN_ID=your_chain_id (optional)
SENTINEL_PRIVATE_KEY=your_private_key (optional)
```

4. In "Settings" → "Deploy", set:
   - **Root Directory**: `/` (or leave blank)
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

5. Railway will auto-detect Python and install dependencies

### 2.3 Get Your Backend URL

1. After deployment, Railway will give you a URL like: `https://your-app.railway.app`
2. Copy this URL - you'll need it for the frontend!

### 2.4 Create `railway.json` (Optional - for better config)

Create `railway.json` in project root:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "uvicorn backend.main:app --host 0.0.0.0 --port $PORT",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## 🎨 Step 3: Deploy Frontend to Vercel

### 3.1 Create Vercel Account

1. Go to https://vercel.com
2. Sign up with GitHub
3. Click "Add New" → "Project"

### 3.2 Import Your Repository

1. Select `kushwahaamar-dev/sentinel` repository
2. Vercel will auto-detect it's a Vite project

### 3.3 Configure Build Settings

**Root Directory**: `frontend`

**Build Command**: `npm run build`

**Output Directory**: `dist`

**Install Command**: `npm install`

### 3.4 Set Environment Variables

Click "Environment Variables" and add:

```
VITE_API_URL=https://your-backend-url.railway.app
```

Replace `your-backend-url.railway.app` with your actual Railway backend URL!

### 3.5 Deploy!

1. Click "Deploy"
2. Wait 2-3 minutes
3. Vercel will give you a URL like: `https://sentinel.vercel.app`

---

## 🔧 Step 4: Update Frontend to Use Production API

We need to make the frontend use the environment variable for the API URL.

### 4.1 Update `frontend/src/App.tsx`

Find this line (around line 46):
```typescript
const API_URL = "http://127.0.0.1:8000";
```

Replace with:
```typescript
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
```

### 4.2 Update CORS in Backend

In `backend/main.py`, update CORS to allow your Vercel domain:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://your-app.vercel.app",  # Add your Vercel URL
        "https://*.vercel.app",  # Allow all Vercel preview deployments
    ],
    allow_credentials=False,
    allow_methods=["*"],
    expose_headers=["*"],
)
```

---

## 🚀 Step 5: Alternative - Deploy Backend to Render

If Railway doesn't work, use Render (also free):

### 5.1 Create Render Account

1. Go to https://render.com
2. Sign up with GitHub
3. Click "New" → "Web Service"

### 5.2 Connect Repository

1. Select your GitHub repo
2. Set:
   - **Name**: `universal-sentinel-backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

### 5.3 Set Environment Variables

Add the same variables as Railway (SENTINEL_MODE, GEMINI_API_KEY, etc.)

### 5.4 Deploy

Click "Create Web Service" and wait for deployment.

---

## ✅ Step 6: Test Your Deployment

1. **Test Backend**: Visit `https://your-backend.railway.app/status`
   - Should return JSON with mode, logs, etc.

2. **Test Frontend**: Visit `https://your-app.vercel.app`
   - Should load the UI
   - Check browser console for errors
   - Try switching to LIVE mode

3. **Test API Connection**: 
   - Open browser DevTools → Network tab
   - Check if requests to `/status` are going to your Railway backend

---

## 🐛 Troubleshooting

### Backend Issues

**Problem**: Backend returns 500 errors
- **Solution**: Check Railway logs, ensure all environment variables are set

**Problem**: CORS errors
- **Solution**: Update `backend/main.py` CORS to include your Vercel domain

**Problem**: Database not working
- **Solution**: Railway provides persistent storage, but you may need to initialize the DB on first run

### Frontend Issues

**Problem**: Frontend can't connect to backend
- **Solution**: 
  1. Check `VITE_API_URL` is set correctly in Vercel
  2. Ensure backend CORS allows your Vercel domain
  3. Check browser console for exact error

**Problem**: Build fails on Vercel
- **Solution**: 
  1. Ensure `Root Directory` is set to `frontend`
  2. Check that `package.json` exists in `frontend/`
  3. Review Vercel build logs

---

## 📝 Quick Checklist

- [ ] Code pushed to GitHub
- [ ] Backend deployed to Railway/Render
- [ ] Backend URL copied
- [ ] Frontend deployed to Vercel
- [ ] `VITE_API_URL` set in Vercel environment variables
- [ ] CORS updated in backend to allow Vercel domain
- [ ] Frontend `App.tsx` uses `import.meta.env.VITE_API_URL`
- [ ] Tested backend endpoint directly
- [ ] Tested frontend loads correctly
- [ ] Tested LIVE mode works

---

## 🎯 Final URLs for Judges

Once deployed, share these with judges:

- **Frontend**: `https://your-app.vercel.app`
- **Backend API**: `https://your-backend.railway.app` (for reference)

**Demo Instructions for Judges:**
1. Visit the frontend URL
2. Switch to MOCK mode for reliable demo
3. Click Dev Tools → Trigger scenarios
4. Or use LIVE mode to see real disasters

---

## 💡 Pro Tips

1. **Use Railway for Backend**: It's the easiest and has a generous free tier
2. **Vercel Preview Deployments**: Every PR gets its own URL - great for testing!
3. **Environment Variables**: Keep sensitive keys in Vercel/Railway, never commit them
4. **Monitor Logs**: Both services provide logs - check them if something breaks
5. **Custom Domain**: You can add a custom domain to Vercel for a professional URL

---

## 🆘 Need Help?

If deployment fails:
1. Check service logs (Railway/Render/Vercel)
2. Verify environment variables are set
3. Ensure CORS is configured correctly
4. Test backend endpoint directly in browser
5. Check browser console for frontend errors

Good luck with your hackathon! 🚀
