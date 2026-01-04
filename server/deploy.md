# Temp Telegram - Free Deployment Guide

This guide outlines how to deploy the "Temp Telegram" app for free using **Vercel** (Frontend) and **Render** (Backend).

## 1. Backend Deployment (Render)
Render offers a free tier for Node.js web services.
**Note**: The free tier spins down after inactivity. When it restarts, all active rooms (stored in RAM) will be wiped. This aligns with the "ephemeral" nature of the app but causes a startup delay of ~50s for the first user.

### Steps:
1.  **Push to GitHub**: Ensure your project is in a GitHub repository.
2.  **Create Web Service**:
    *   Go to [dashboard.render.com](https://dashboard.render.com).
    *   Click **New +** -> **Web Service**.
    *   Connect your GitHub repo.
3.  **Configuration**:
    *   **Root Directory**: `server`
    *   **Runtime**: `Node`
    *   **Build Command**: `npm install`
    *   **Start Command**: `node index.js`
    *   **Instance Type**: `Free`
4.  **Environment Variables**:
    *   Add `CLIENT_URL`: Set this to your future frontend URL (e.g., `https://your-app.vercel.app`). You can update this later after deploying the frontend.
    *   Add `PORT`: `3000` (Render usually sets this auto, but good to be explicit or use default).
5.  **Deploy**: Click **Create Web Service**.
6.  **Copy URL**: Once live, copy the backend URL (e.g., `https://temp-telegram-api.onrender.com`).

---

## 2. Frontend Deployment (Vercel)
Vercel is optimized for React/Vite apps.

### Steps:
1.  **Create Project**:
    *   Go to [vercel.com](https://vercel.com) and log in.
    *   Click **Add New...** -> **Project**.
    *   Import your GitHub repo.
2.  **Configuration**:
    *   **Framework Preset**: Vite
    *   **Root Directory**: Click "Edit" and select `client`.
3.  **Environment Variables**:
    *   Wait! We need to hardcode the backend URL or use Vercel env vars.
    *   **Option A (Recommended)**:
        *   In your `client/src/pages/ChatRoom.jsx` and `Home.jsx`, the code currently points to `http://localhost:3001`.
        *   **Change this**: Update the `ENDPOINT` constant to use `import.meta.env.VITE_SERVER_URL`.
    *   **Vercel Dashboard**: Add Environment Variable:
        *   `VITE_SERVER_URL`: Paste your Render Backend URL (e.g., `https://temp-telegram-api.onrender.com`).
4.  **Deploy**: Click **Deploy**.

## 3. Post-Deployment Check
1.  **Update Backend CORS**:
    *   Go back to Render Dashboard -> Environment.
    *   Update `CLIENT_URL` to your new Vercel frontend URL (e.g., `https://temp-telegram-frontend.vercel.app`).
    *   Render will auto-redeploy.
2.  **Verify**:
    *   Open your Vercel URL.
    *   Create a room.
    *   Check if you can join and chat.

## Alternative: Railway (Backend)
If Render's spin-down is annoying, **Railway** offers a trial but eventually requires a small payment ($5/mo) for 24/7 uptime. The setup is similar: connect repo, set root dir to `server`, `npm install && node index.js`.
