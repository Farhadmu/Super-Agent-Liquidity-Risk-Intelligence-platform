# API Endpoint Documentation
**Multi-Provider Super Agent Liquidity Intelligence Platform (SALI)**

The SALI backend is built on **FastAPI**, exposing high-performance asynchronous REST endpoints for agent overview, risk forecasting, anomaly detection, operational incident state machine, and sandbox simulation.

---

## 📌 Base Configuration
- **Swagger Interactive UI**: Available at `http://localhost:8080/docs` (or your deployed Render URL) on startup.
- **Alternative Redoc UI**: Available at `http://localhost:8080/redoc`.
- **Response Format**: All responses are JSON payloads.

---

## 👥 User Roles & Access Scope
Access control headers or request properties scope data visibility:
- `admin` / `management`: Can view and query all cases, execute reassignment actions, and modify sandbox scenario configurations.
- `provider_ops`: Can view, acknowledge, and resolve cases assigned to Provider Operations.
- `field_officer`: Can view, acknowledge, and resolve cases assigned to Field Officers.
- `risk_analyst`: Can view, acknowledge, and resolve cases assigned to Risk Analysts.

---

## 1. Agents Routing (`/agents`)

### 🔹 Get All Agents
Returns list of all active super-agent outlets.
- **Endpoint**: `GET /agents/`
- **Response `200 OK`**:
```json
[
  {
    "id": 1,
    "agent_code": "A001",
    "name": "Sajib Telecom",
    "area": "Dhanmondi Road 15",
    "created_at": "2026-07-11T12:00:00Z"
  }
]
```

### 🔹 Get Agent Overview (Unified Balance View)
Calculates and merges separate provider e-money positions and the shared physical cash drawer balance.
- **Endpoint**: `GET /agents/{agent_id}/overview`
- **Response `200 OK`**:
```json
{
  "agent_id": 1,
  "agent_code": "A001",
  "name": "Sajib Telecom",
  "area": "Dhanmondi Road 15",
  "shared_cash": 100000.0,
  "provider_balances": [
    {
      "provider_name": "bKash",
      "balance": 5000.0,
      "display_color": "#e2125a",
      "last_updated": "2026-07-11T13:50:00Z",
      "is_delayed": false
    }
  ]
}
```

### 🔹 Get Rolling Liquidity Forecast
Calculates provider-level net burn rates, depletion ETAs, confidence indicators, and trilingual advisor recommendations.
- **Endpoint**: `GET /agents/{agent_id}/liquidity-forecast`
- **Response `200 OK`**:
```json
{
  "agent_id": 1,
  "agent_code": "A001",
  "forecasts": [
    {
      "provider_name": "bKash",
      "risk_level": "high",
      "eta_minutes": 6,
      "confidence": 0.6,
      "reason_en": "Depletion warning: High net burn rate detected for bKash. Wallet balance is dropping rapidly.",
      "reason_bn": "📣 বর্তমান লেনদেনের ধারা অনুযায়ী কয়েক মিনিটের মধ্যে আপনার বিকাশ ই-মানি শেষ হয়ে যেতে পারে।",
      "reason_banglish": "Apnar bKash e-money balance druto komche.",
      "current_balance": 5000.0
    }
  ]
}
```

---

## 2. Incident Coordination Machine (`/cases`)

### 🔹 List Coordination Cases
Lists open, acknowledged, escalated, or resolved incident cases. Filters by role.
- **Endpoint**: `GET /cases`
- **Query Parameters**:
  - `role` (Optional): Filter cases assigned to `provider_ops`, `field_officer`, or `risk_analyst`.
  - `status` (Optional): Filter cases by `open`, `acknowledged`, `escalated`, `resolved`.
- **Response `200 OK`**:
```json
[
  {
    "id": 1,
    "source_type": "liquidity",
    "source_id": 1,
    "agent_code": "A001",
    "provider_name": "bKash",
    "severity": "urgent",
    "status": "open",
    "assigned_role": "provider_ops",
    "assigned_to": null,
    "recommended_action": "Contact bKash distributor to top up e-money wallet.",
    "timeline": []
  }
]
```

### 🔹 Acknowledge Case
Assigns case ownership to the signed-in representative.
- **Endpoint**: `POST /cases/{case_id}/acknowledge`
- **Request Body**:
```json
{
  "actor_name": "Officer Tanvir",
  "actor_role": "provider_ops"
}
```
- **Response `200 OK`**:
```json
{
  "status": "success",
  "message": "Case #1 acknowledged by Officer Tanvir."
}
```

### 🔹 Reassign Department / Routing
Transitions case control and routing to another operations department. Restricted to **Management** and **Super Admin**.
- **Endpoint**: `POST /cases/{case_id}/reassign`
- **Request Body**:
```json
{
  "target_role": "field_officer",
  "actor_name": "Lead Nusrat",
  "actor_role": "management",
  "reason": "Escalating for physical cash support delivery."
}
```

### 🔹 Resolve Case
Marks case as resolved, terminating warnings.
- **Endpoint**: `POST /cases/{case_id}/resolve`
- **Request Body**:
```json
{
  "actor_name": "Officer Tanvir",
  "actor_role": "provider_ops",
  "resolution_note": "Distributor delivered BDT 20,000 top-up."
}
```

### 🔹 AI Chatbot Diagnosis & Triage
Processes incoming agent messages, analyzes them using real-time wallet and alert context, and conditionally creates support tickets based on classification.
- **Endpoint**: `POST /cases/chat-diagnose`
- **Request Body**:
```json
{
  "message": "My Rocket balance feed is lagging and has not updated for 3 hours",
  "agent_id": 1
}
```
- **Response `200 OK` (Ticket Created)**:
```json
{
  "reply": "I understand you are facing issues with connection lag/sync. I have raised a system ticket for the Provider Operations team to inspect. Please wait while they troubleshoot.",
  "case_id": 20,
  "status": "open",
  "assigned_role": "provider_ops"
}
```
- **Response `200 OK` (No Ticket Created for Trivial Queries/Greetings)**:
```json
{
  "reply": "Thank you for reaching out to MFS Agent Support. How can I help you today?",
  "case_id": null,
  "status": "closed",
  "assigned_role": null
}
```

---

## 3. Demo Simulator Sandbox (`/simulate`)

### 🔹 Inject Custom Scenarios
Allows judges to create dynamic simulation states. Commits balances, recalculates velocities, runs IsolationForest, and triggers case alerts.
- **Endpoint**: `POST /simulate/custom-scenario`
- **Request Body**:
```json
{
  "agent_id": 1,
  "shared_cash": 120000.0,
  "bkash_balance": 5000.0,
  "nagad_balance": 80000.0,
  "rocket_balance": 60000.0,
  "inject_anomaly": true,
  "anomaly_burst_count": 5,
  "anomaly_amount": 9999.0
}
```
- **Response `200 OK`**:
```json
{
  "status": "success",
  "message": "Custom scenario applied for Agent A001.",
  "details": {
    "shared_cash": 120000.0,
    "injected_transactions": 5,
    "flagged_anomalies": 3
  }
}
```

---

## 4. Analytical Metrics (`/metrics`)

### 🔹 Get System and Analytical Validation
Returns live precision, recall, latencies, and explanation coverage ratios.
- **Endpoint**: `GET /metrics/validation`
- **Response `200 OK`**:
```json
{
  "anomaly_detection": {
    "true_positives": 5,
    "false_positives": 0,
    "false_negatives": 0,
    "precision": 1.0,
    "recall": 1.0,
    "false_positive_rate": 0.0111
  },
  "liquidity_forecasting": {
    "lead_time_minutes": 6,
    "accuracy_ratio": 0.98,
    "context": "Scenario A bKash shortage warning gives operators about 6 minutes to act..."
  },
  "system_performance": {
    "average_api_latency_ms": 3.08,
    "p95_api_latency_ms": 5.54,
    "data_scale_transactions": 452
  },
  "explainability": {
    "explanation_coverage_percentage": 100.0
  }
}
```

---

## 5. System Intelligence & Stream Endpoints (`/api`)

### 🔹 Server-Sent Events (SSE) Stream
Opens a persistent HTTP keep-alive connection to receive real-time updates.
- **Endpoint**: `GET /api/stream`
- **Events Broadcasted**:
  - `case_update`: Triggered when case status, ownership, or department reassignment occurs.
  - `scenario_update`: Broadcasted when new custom sandbox scenarios or transaction bursts are injected.
  - `data_reset`: Fired when the database is seeded or reset back to default states.

### 🔹 Liquidity Rebalancing Recommendations
Returns a set of optimal rebalancing instructions across provider wallets and shared cash pools.
- **Endpoint**: `GET /agents/{agent_id}/rebalance`
- **Response `200 OK`**:
  - Returns a checklist of recommended electronic transfers or cash-out redirects, matching surplus wallets to deficit pools.

### 🔹 Custom Prompt Advisory Playground
Simulates LLM response generation with a custom system prompt and input data context.
- **Endpoint**: `POST /simulate/advisory-preview`
- **Request Body**:
```json
{
  "custom_system_prompt": "You are a risk supervisor. Generate high priority warnings.",
  "context_type": "liquidity"
}
```
- **Response `200 OK`**:
```json
{
  "en": "English advisory text...",
  "bn": "Bangla translation...",
  "banglish": "Banglish translation..."
}
```
