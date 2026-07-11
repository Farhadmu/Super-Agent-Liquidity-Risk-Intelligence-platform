# Multi-Provider Super Agent — Technical Architecture
**Codex Community Hackathon — bKash presents SUST CSE Carnival 2026**

A decision-support prototype that helps a multi-provider "super agent" and operations teams manage liquidity forecasts, transaction anomalies, and case resolution without auto-blocking accounts or mixing wallet boundaries.

---

## 1. Project Structure
```
project/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI Entrypoint
│   │   ├── models/            # SQLAlchemy schemas & DB session
│   │   ├── routers/           # Agents, Cases, Simulate, Metrics APIs
│   │   ├── services/          # Liquidity, Anomaly, Coordination engines
│   │   └── ml/                # IsolationForest train script & model
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Unified Agent + Ops View Dashboard
│   │   └── index.css          # Glassmorphism Dark Theme stylesheet
│   └── package.json
├── data/
│   └── synthetic/              # Raw CSV dumps for judges inspection
├── docs/
│   ├── architecture-diagram.md
│   ├── data-simulation-note.md
│   └── responsible-design-note.md
└── README.md
```

---

## 2. Technical Stack
- **Backend**: Python 3.13 / FastAPI (CORS-enabled gateway, async endpoints)
- **Database**: PostgreSQL (SQLAlchemy ORM for transaction velocity tracking)
- **ML Anomaly Detection**: scikit-learn `IsolationForest` (trained on a 7-day normal baseline, contamination=0.03)
- **Frontend**: React (Vite-scaffolded, structured view, styled with custom Vanilla CSS glassmorphism)

---

## 3. Quickstart Installation & Setup

### Prerequisites
- macOS with Homebrew installed
- Python 3.10+
- Node.js (v18+) & npm

### Step 1: Database Setup
Start local PostgreSQL service and create the database:
```bash
brew install postgresql@18
brew services start postgresql@18
/opt/homebrew/opt/postgresql@18/bin/psql -h localhost -d postgres -c "CREATE DATABASE super_agent;"
```

### Step 2: Backend Installation & Run
Create virtual environment, install requirements, and run FastAPI:
```bash
# Create venv
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Run initial seed and train ML IsolationForest
python backend/app/simulator/generate_data.py

# Export CSV baseline reports
python backend/app/simulator/export_csv.py

# Run FastAPI Gateway (starts on http://localhost:8080)
uvicorn backend.app.main:app --host 0.0.0.0 --port 8080 --reload
```

### Step 3: Frontend Installation & Run
Initialize node modules and start development server:
```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 3000
```
Open **[http://localhost:3000/](http://localhost:3000/)** in your browser.

---

## 4. Guide to Demo Scenarios

### Scenario A — Hidden Provider Shortage
- **Where to see**: Select **Agent A001** (Sajib Telecom) on the Agent Dashboard.
- **Narrative**: The agent's total value looks healthy (~$295,000$ BDT), but the bKash balance is depleted to $5,000$ BDT due to a high volume of cash-in transactions. 
- **System Output**: Shows a high-risk warning box with a bilingual alert (English + Bengali) warning the agent that bKash e-money will run out in ~6 minutes.

### Scenario B — Shared Cash Shortage with Anomaly
- **Where to see**: Select **Agent A002** (Mayer Doa Enterprise) on the Agent Dashboard.
- **Narrative**: High cash-out velocity drains physical cash to $8,000$ BDT. In addition, a wave of 5 identical $9,999$ BDT transactions occurs from the same account ID (`CUST_SUSPECT`) in 15 minutes.
- **System Output**: Displays a high-risk cash shortage alert *and* registers a high-confidence anomaly flag. In the **Ops Control Room**, a case is routed to the **Risk Analyst** role with a detailed evidence panel showing velocity, mean deviation, and counterparty repetition.

### Scenario C — Data Inconsistency & Delay
- **Where to see**: Select **Agent A003** (Riyad Variety Store) on the Agent Dashboard.
- **Narrative**: The Rocket balance feed has failed to update for 3 hours.
- **System Output**: The forecaster reduces the forecast confidence to $15\%$, rendering a warnings panel alerting the user that data is lagging and inconsistent.

### Scenario D — Coordinated Case Closure
- **Where to see**: Open **Ops Control Room** tab.
- **Narrative**: Select any case from the queue. Change acting user to the routed role (e.g. Risk Analyst or Provider Ops).
- **System Output**: Click **Acknowledge Case** (assigns owner). Click **Escalate** or **Resolve** and type notes. Verify that the changes appear instantly in the **Case Coordination Audit Trail** (timeline) showing actor roles and timestamps.

---

## 5. System Analytics & Validation
Click the **Validation Metrics** button at the top header of the UI to display the live metrics drawer:
1. **Anomaly Precision/Recall**: Calculated over Scenario B injected cases.
2. **False-Positive Rate**: Checked against baseline normal historical traffic.
3. **Forecasting Lead Time**: Evaluated on Scenario A shortage alerts.
4. **Endpoint Latencies**: Live measured roundtrip database timing.

# Super-Agent-Liquidity-Risk-Intelligence-platform
