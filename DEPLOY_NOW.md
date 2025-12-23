# 🚀 DEPLOY NOW - Step by Step

Follow these steps in order. Should take ~10 minutes total.

---

## ✅ PRE-FLIGHT CHECKLIST

- [ ] All code is working locally
- [ ] You have a GitHub account
- [ ] Your code is pushed to: `https://github.com/kushwahaamar-dev/sentinel.git`
- [ ] You have your `GEMINI_API_KEY` ready

---

## 📦 STEP 1: Push Code to GitHub (2 min)

```bash
cd /Users/amar/Codes/universal-sentinel

# Check status
git status

# Add all files
git add .

# Commit
git commit -m "Ready for production deployment"

# Push to GitHub
git push origin main
```

**Verify**: Go to https://github.com/kushwahaamar-dev/sentinel and confirm all files are there.

---

## 🚂 STEP 2: Deploy Backend to Railway (3 min)

### 2.1 Create Account
1. Visit: https://railway.app
2. Click "Start a New Project"
3. Sign in with **GitHub**
4. Authorize Railway to access your repos

### 2.2 Deploy Backend
1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Find and select: `kushwahaamar-dev/sentinel`
4. Railway will auto-detect Python

### 2.3 Configure Service
1. Railway creates a service automatically
2. Click on the service → **"Variables"** tab
3. Add these environment variables:

```
SENTINEL_MODE = LIVE
GEMINI_API_KEY = your_actual_gemini_key_here
```

(Optional - only if you have blockchain configured):
```
RPC_URL = your_rpc_url
CONTRACT_ADDRESS = your_contract_address
CHAIN_ID = 11155111
SENTINEL_PRIVATE_KEY = your_private_key
```

### 2.4 Set Start Command
1. Click **"Settings"** tab
2. Scroll to **"Deploy"** section
3. Set **Start Command**:
```
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

### 2.5 Get Your Backend URL
1. Click **"Settings"** → **"Networking"**
2. Click **"Generate Domain"**
3. Copy the URL (e.g., `https://sentinel-production.up.railway.app`)
4. **SAVE THIS URL** - you'll need it next!

### 2.6 Test Backend
Open the URL in browser: `https://your-backend.railway.app/status`
- Should show JSON with `{"mode": "LIVE", ...}`

---

## 🎨 STEP 3: Deploy Frontend to Vercel (3 min)

### 3.1 Create Account
1. Visit: https://vercel.com
2. Click **"Sign Up"**
3. Sign in with **GitHub**
4. Authorize Vercel

### 3.2 Import Project
1. Click **"Add New"** → **"Project"**
2. Find: `kushwahaamar-dev/sentinel`
3. Click **"Import"**

### 3.3 Configure Build
1. **Root Directory**: Click "Edit" → Set to `frontend`
2. **Framework Preset**: Should auto-detect "Vite" ✅
3. **Build Command**: `npm run build` (auto-filled)
4. **Output Directory**: `dist` (auto-filled)
5. **Install Command**: `npm install` (auto-filled)

### 3.4 Set Environment Variable
1. Scroll to **"Environment Variables"**
2. Click **"Add"**
3. Add:
   - **Key**: `VITE_API_URL`
   - **Value**: Your Railway backend URL (from Step 2.5)
   - Example: `https://sentinel-production.up.railway.app`

### 3.5 Deploy!
1. Click **"Deploy"** button
2. Wait 2-3 minutes
3. Vercel will show: **"Congratulations! Your project has been deployed"**
4. **Copy your Vercel URL** (e.g., `https://sentinel.vercel.app`)

---

## 🧪 STEP 4: Test Everything (2 min)

### 4.1 Test Frontend
1. Visit your Vercel URL
2. Open browser DevTools (F12) → Console tab
3. Check for errors
4. Should see: "BACKEND: ONLINE [LIVE]"

### 4.2 Test MOCK Mode
1. Click the mode toggle → Switch to MOCK
2. Click Dev Tools (bottom-right)
3. Click "Trigger: Quake"
4. Should see disaster appear on globe!

### 4.3 Test LIVE Mode
1. Switch back to LIVE mode
2. Wait 30 seconds
3. Should see real disasters from GDACS/EONET/NWS appear!

### 4.4 If CORS Errors Appear
If you see CORS errors in console:
1. Go back to Railway
2. Edit `backend/main.py` (or use Railway's file editor)
3. Update CORS to include your Vercel domain
4. Redeploy on Railway

---

## 🎯 STEP 5: Share with Judges!

Your live URLs:
- **Frontend**: `https://your-app.vercel.app`
- **Backend API**: `https://your-backend.railway.app` (for reference)

**Demo Instructions for Judges:**
1. Visit the frontend URL
2. Use MOCK mode for reliable demo (click mode toggle)
3. Trigger scenarios from Dev Tools
4. Or use LIVE mode to see real disasters!

---

## 🐛 TROUBLESHOOTING

### Backend won't start on Railway
- Check Railway logs: Click service → "Deployments" → View logs
- Ensure `requirements.txt` has all dependencies
- Verify start command is correct

### Frontend can't connect to backend
- Check `VITE_API_URL` is set correctly in Vercel
- Verify backend URL works: Visit `https://your-backend.railway.app/status`
- Check browser console for exact error

### CORS errors
- Backend CORS is set to `["*"]` which should work
- If still issues, update `backend/main.py` CORS to include your Vercel domain
- Redeploy backend

### Build fails on Vercel
- Ensure Root Directory is set to `frontend`
- Check Vercel build logs
- Verify `package.json` exists in `frontend/`

---

## ✅ DEPLOYMENT CHECKLIST

- [ ] Code pushed to GitHub
- [ ] Backend deployed to Railway
- [ ] Backend URL copied
- [ ] Frontend deployed to Vercel
- [ ] `VITE_API_URL` set in Vercel
- [ ] Frontend loads without errors
- [ ] MOCK mode works
- [ ] LIVE mode works
- [ ] No CORS errors in console

---

## 🎉 YOU'RE LIVE!

Your app is now accessible to judges worldwide! 🚀

**Pro Tip**: Vercel gives you a free custom domain option. You can add `sentinel.yourdomain.com` for a professional look!
