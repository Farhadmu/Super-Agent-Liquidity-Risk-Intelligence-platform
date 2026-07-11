# Render Deployment Guide

This guide provides step-by-step instructions to deploy the **Super Agent Liquidity Risk Intelligence Platform** on [Render.com](https://render.com).

The application is split into:
1. **FastAPI Backend (Web Service)**: Serves prediction algorithms, feeds, and coordination cases.
2. **React Frontend (Static Site)**: A highly performant, responsive glassmorphic dashboard built with Vite.

---

## 🚀 Quick Deploy: Render Blueprint (Recommended)

Render supports Infrastructure-as-Code via **Render Blueprints**. To deploy the entire stack automatically, create a `render.yaml` file in the root of your repository with the contents below.

### `render.yaml` Blueprint Configuration

```yaml
services:
  # 1. FastAPI Backend Service
  - type: web
    name: super-agent-liquidity-backend
    env: python
    buildCommand: pip install -r backend/requirements.txt
    startCommand: uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.5
      - key: GEMINI_API_KEY
        sync: true  # Render will prompt for your API key
      - key: CHATGPT_API_KEY
        value: ""   # Optional fallback API key
      - key: DATABASE_URL
        value: "sqlite:///./production.db" # Default fallback database

  # 2. React Frontend Static Site
  - type: web
    name: super-agent-liquidity-frontend
    env: static
    buildCommand: npm install && npm run build
    publishDir: frontend/dist
    rootDir: frontend
    envVars:
      - key: VITE_API_URL
        fromService:
          type: web
          name: super-agent-liquidity-backend
          property: host
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```

To deploy using this blueprint:
1. Log in to **Render Dashboard**.
2. Click **New** -> **Blueprint**.
3. Select your repository, and click **Apply**.

---

## 🛠️ Manual Deployment Steps

If you prefer to configure the services manually on Render, follow the instructions below.

### 1. Deploy the FastAPI Backend (Web Service)

1. Click **New** -> **Web Service** in your Render Dashboard.
2. Select your repository.
3. Configure the following parameters:
   - **Name**: `super-agent-liquidity-backend`
   - **Environment**: `Python`
   - **Branch**: `main`
   - **Root Directory**: `.` (leave blank to use project root)
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free` (or custom tier)
4. Add the following **Environment Variables** under the "Advanced" settings:
   - `GEMINI_API_KEY`: *(Optional)* Your Google Gemini API Key.
   - `CHATGPT_API_KEY`: *(Optional)* Your OpenAI API Key.
   - `PYTHON_VERSION`: `3.11.5` (or higher)
5. Click **Create Web Service**.

> [!NOTE]
> On startup, the backend automatically detects if the SQLite database is empty and runs `seed_database()` to prepopulate it with baseline data. This guarantees that your live demo works immediately without manual seeding commands.

---

### 2. Deploy the React Frontend (Static Site)

1. Click **New** -> **Static Site** in your Render Dashboard.
2. Select your repository.
3. Configure the following parameters:
   - **Name**: `super-agent-liquidity-frontend`
   - **Branch**: `main`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Add the following **Environment Variables** under settings:
   - `VITE_API_URL`: The URL of the backend web service you deployed in Step 1 (e.g., `https://super-agent-liquidity-backend.onrender.com`).
5. Configure **Redirects/Rewrites** to handle SPA Routing:
   - Under the **Redirects/Rewrites** tab, add a rule:
     - **Source**: `/*`
     - **Action**: `Rewrite`
     - **Destination**: `/index.html`
6. Click **Create Static Site**.

---

## 🧪 Verification and Verification Checklist

Once both services show a status of **Live**, verify your deployment using this checklist:

1. **Dashboard Load**: Open your frontend URL (e.g. `https://super-agent-liquidity-frontend.onrender.com`). The login page should load cleanly.
2. **Demo Access**: Enter the dashboard by signing in as a role (e.g. Ops Officer Amina). The dashboard should successfully fetch and display active metrics and charts.
3. **Interactive Visualizer**: Go to the Agent view and verify that hovering over the **2-Hour Liquidity Trend Visualizer** dynamically loads balance details at the bottom of the chart.
4. **Sandbox Simulation**:
   - Manually type the username `admin.demo` and password `demo123` on the login page (credentials are hidden from cards/menus for security).
   - Enter the Sandbox and modify the Nagad wallet balance. Confirm that the status card, forecasts, and Cases update in real-time.
