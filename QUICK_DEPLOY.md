# 🚀 Quick Free Deployment (5 Minutes)

Deploy Universal Sentinel for **FREE** so judges can access it.

## Option 1: Render (Easiest - Single Platform)

### Backend + Frontend on Render

1. **Sign up**: https://render.com (free with GitHub)

2. **Deploy Backend**:
   - New → Web Service
   - Connect repo: `kushwahaamar-dev/sentinel`
   - Settings:
     - Name: `universal-sentinel-backend`
     - Build: `pip install -r requirements.txt`
     - Start: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
     - Plan: **Free**
   - Environment:
     - `SENTINEL_MODE=LIVE`
     - `GEMINI_API_KEY=your_key`
   - Deploy → Copy URL (e.g., `https://universal-sentinel-backend.onrender.com`)

3. **Deploy Frontend**:
   - New → Static Site
   - Connect repo: `kushwahaamar-dev/sentinel`
   - Settings:
     - Root Directory: `frontend`
     - Build: `npm install && npm run build`
     - Publish: `frontend/dist`
   - Environment:
     - `VITE_API_URL=https://your-backend-url.onrender.com`
   - Deploy → Copy URL

**Done!** Share frontend URL with judges.

---

## Option 2: Vercel + Render (Best Performance)

### Backend: Render | Frontend: Vercel

**Backend (Render)** - Same as Option 1, Step 2

**Frontend (Vercel)**:
1. Sign up: https://vercel.com (free with GitHub)
2. Import repo: `kushwahaamar-dev/sentinel`
3. Settings:
   - Framework: Vite
   - Root: `frontend`
   - Build: `npm run build`
   - Output: `dist`
4. Environment:
   - `VITE_API_URL=https://your-backend-url.onrender.com`
5. Deploy

**Done!** Vercel gives you a URL like `https://sentinel-xyz.vercel.app`

---

## ⚡ Keep Backend Alive (Optional)

Render free tier sleeps after 15 min. Keep it awake:

1. Go to https://cron-job.org (free)
2. Create job: `GET https://your-backend-url.onrender.com/status`
3. Run every 14 minutes

---

## ✅ Test Checklist

- [ ] Backend URL works: `/status` returns JSON
- [ ] Frontend loads
- [ ] Mode toggle works
- [ ] MOCK scenarios work
- [ ] LIVE mode shows disasters
- [ ] Stats panel works
- [ ] Payment pop-up appears

---

**Share this with judges**: Your frontend URL

Good luck! 🎉
