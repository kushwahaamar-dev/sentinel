# ⚡ Quick Deployment Steps

## 🚀 Fastest Way to Deploy (5 minutes)

### Step 1: Push to GitHub
```bash
cd /Users/amar/Codes/universal-sentinel
git add .
git commit -m "Ready for deployment"
git push origin main
```

### Step 2: Deploy Backend to Railway

1. Go to https://railway.app → Sign up with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select `kushwahaamar-dev/sentinel`
4. Railway auto-detects Python
5. Add environment variables:
   - `SENTINEL_MODE=LIVE`
   - `GEMINI_API_KEY=your_key_here`
6. Railway will auto-deploy!
7. **Copy your Railway URL** (e.g., `https://sentinel-production.up.railway.app`)

### Step 3: Deploy Frontend to Vercel

1. Go to https://vercel.com → Sign up with GitHub
2. Click "Add New" → "Project"
3. Import `kushwahaamar-dev/sentinel`
4. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite (auto-detected)
5. Add environment variable:
   - `VITE_API_URL` = Your Railway backend URL (from Step 2)
6. Click "Deploy"
7. **Copy your Vercel URL** (e.g., `https://sentinel.vercel.app`)

### Step 4: Update Backend CORS (if needed)

If you get CORS errors, update `backend/main.py`:

```python
allow_origins=[
    "http://localhost:5173",
    "https://your-app.vercel.app",  # Your Vercel URL
    "https://*.vercel.app",
],
```

Then redeploy backend on Railway.

### Step 5: Test!

1. Visit your Vercel URL
2. Check browser console for errors
3. Try MOCK mode first
4. Then try LIVE mode

---

## 🎯 That's It!

Your app is now live at: `https://your-app.vercel.app`

Share this URL with judges! 🚀
