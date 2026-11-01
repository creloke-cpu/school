# Node.js + React Fullstack App (Railway Ready)

A simple, clean fullstack application with Express, React 18 (Vite), and a production multi-stage Dockerfile configured for instant deployment on **Railway**.

---

## 📁 Project Structure

```text
d:\School\
├── backend/
│   ├── .env                  # Backend environment variables
│   ├── .env.example
│   ├── Dockerfile            # Standalone backend container
│   ├── package.json
│   └── server.js             # Express API + React static file serving
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── App.jsx           # Clean one-page test dashboard
│       ├── index.css
│       └── main.jsx
├── Dockerfile                # Root multi-stage Dockerfile (Frontend + Backend for Railway)
├── railway.json              # Railway deployment configuration
├── docker-compose.yml        # Local container testing
├── package.json
└── README.md
```

---

## 🚂 Deploy to Railway (Step-by-Step)

### Option 1: Via GitHub (Recommended)
1. Push this folder to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
2. Log into [Railway.app](https://railway.app).
3. Click **"New Project"** → **"Deploy from GitHub repo"**.
4. Select your repository.
5. Railway automatically detects `Dockerfile` and `railway.json`.
6. Once deployed, click on your project service → **Settings** → **Networking** → Click **"Generate Domain"** (e.g. `your-app.up.railway.app`).
7. Open the generated domain in your browser! Both the React UI and the Node.js API are live!

### Option 2: Via Railway CLI
```bash
# 1. Install Railway CLI (if not installed)
npm install -g @railway/cli

# 2. Login to Railway
railway login

# 3. Initialize project
railway init

# 4. Deploy container
railway up
```

---

## 🔑 Key Railway Compatibility Features
1. **Dynamic Port**: Railway assigns `PORT` at runtime. The backend automatically reads `process.env.PORT` and binds to `0.0.0.0`.
2. **Zero CORS Issues**: The React client and Express API run together on the same domain, so `/api/test` calls work seamlessly out-of-the-box.
3. **Multi-stage Build**: React is built in Stage 1 and served by Node.js in Stage 2, keeping the final container lightweight and fast.
