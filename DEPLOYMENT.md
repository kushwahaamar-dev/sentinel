# Free Deployment Guide for Universal Sentinel

This guide will help you deploy Universal Sentinel for **FREE** so judges can access it during your hackathon.

## 🎯 Deployment Strategy

- **Backend**: Render.com (Free tier - Python web service)
- **Frontend**: Vercel.com (Free tier - Static site hosting)
- **Total Cost**: $0/month

## 📋 Prerequisites

1. GitHub account (you already have: `kushwahaamar-dev/sentinel`)
2. Render.com account (free signup)
3. Vercel account (free signup with GitHub)

---

## 🚀 Step 1: Deploy Backend on Render

### 1.1 Sign up for Render

- Go to https://render.com
- Sign up with your GitHub account

### 1.2 Create New Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository: `kushwahaamar-dev/sentinel`
3. Configure:
   - **Name**: `universal-sentinel-backend`
   - **Region**: Choose closest to you (e.g., `Oregon (US West)`)
   - **Branch**: `main`
   - **Root Directory**: Leave empty (root)
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `PYTHONPATH=/opt/render/project/src uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: **Free** (select this!)
   - **Environment Variables**: Add `PYTHONPATH=/opt/render/project/src` (important!)

### 1.3 Set Environment Variables

Click **"Environment"** tab and add:

```
SENTINEL_MODE=LIVE
GEMINI_API_KEY=your_gemini_api_key_here
PYTHON_VERSION=3.12.0
```

**Optional** (for real blockchain):

```
RPC_URL=your_rpc_url
CONTRACT_ADDRESS=your_contract_address
CHAIN_ID=11155111
SENTINEL_PRIVATE_KEY=your_private_key
```

### 1.4 Deploy

- Click **"Create Web Service"**
- Wait 5-10 minutes for first deployment
- Copy your backend URL (e.g., `https://universal-sentinel-backend.onrender.com`)

### 1.5 Test Backend

Visit: `https://your-backend-url.onrender.com/status`
Should return JSON with `{"mode": "LIVE", ...}`

---

## 🎨 Step 2: Deploy Frontend on Vercel

### 2.1 Sign up for Vercel

- Go to https://vercel.com
- Sign up with your GitHub account

### 2.2 Import Project

1. Click **"Add New..."** → **"Project"**
2. Import `kushwahaamar-dev/sentinel`
3. Configure:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### 2.3 Set Environment Variables

Click **"Environment Variables"** and add:

```
VITE_API_URL=https://your-backend-url.onrender.com
```

Replace `your-backend-url` with your actual Render backend URL.

### 2.4 Deploy

- Click **"Deploy"**
- Wait 2-3 minutes
- Vercel will give you a URL like: `https://sentinel-xyz.vercel.app`

### 2.5 Update CORS (Important!)

After backend deploys, update `backend/main.py` CORS to include your Vercel domain:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://your-vercel-app.vercel.app",
        "http://localhost:5173",  # Keep for local dev
    ],
    allow_credentials=False,
    allow_methods=["*"],
    expose_headers=["*"],
)
```

Then push and redeploy backend.

---

## 🔧 Step 3: Update Frontend API URL

### Option A: Environment Variable (Recommended)

The frontend already uses `VITE_API_URL` if set. Vercel will inject it during build.

### Option B: Update Code

If needed, update `frontend/src/App.tsx`:

```typescript
const API_URL = import.meta.env.VITE_API_URL || "https://your-backend-url.onrender.com";
```

---

## ✅ Step 4: Test Everything

1. **Frontend**: Visit your Vercel URL
2. **Check Mode Toggle**: Switch between LIVE/MOCK
3. **Test MOCK Mode**: Click Dev Tools → Trigger scenarios
4. **Test LIVE Mode**: Wait for real disasters to appear
5. **Check Stats**: Click "Stats" button
6. **Check History**: Click "History" button

---

## 🎯 For Judges Demo

**Share this link**: `https://your-vercel-app.vercel.app`

**Demo Flow**:

1. Show LIVE mode (real disasters from APIs)
2. Switch to MOCK mode
3. Trigger scenarios (Quake/Fire/Storm)
4. Show payment receipt pop-up
5. Show Stats panel with NGO info
6. Show History panel

---

## 🆓 Free Tier Limits

### Render (Backend)

- ✅ 750 hours/month free
- ✅ Auto-sleeps after 15 min inactivity (wakes on request)
- ✅ First wake-up takes ~30 seconds
- ⚠️ **Solution**: Keep-alive ping every 14 minutes (optional)

### Vercel (Frontend)

- ✅ Unlimited requests
- ✅ Auto-scaling
- ✅ No sleep (always on)
- ✅ Perfect for hackathon demos

---

## 🔄 Keep Backend Alive (Optional)

If backend sleeps, create a free cron job:

1. Go to https://cron-job.org (free)
2. Create job: `GET https://your-backend-url.onrender.com/status`
3. Run every 14 minutes

---

## 🐛 Troubleshooting

### Backend not responding?

- Check Render logs: Dashboard → Your Service → Logs
- Verify environment variables are set
- Check if service is sleeping (first request after sleep takes 30s)

### Frontend can't connect to backend?

- Verify `VITE_API_URL` is set correctly
- Check CORS settings in backend
- Check browser console for errors

### CORS errors?

- Update `backend/main.py` CORS origins to include Vercel domain
- Redeploy backend after CORS update

---

## 📝 Quick Checklist

- [ ] Backend deployed on Render
- [ ] Backend URL copied
- [ ] Frontend deployed on Vercel
- [ ] `VITE_API_URL` set in Vercel
- [ ] CORS updated in backend
- [ ] Tested MOCK mode
- [ ] Tested LIVE mode
- [ ] Shared Vercel URL with judges

---

**Your deployed app will be live at**: `https://your-vercel-app.vercel.app`

Good luck with your hackathon! 🚀
