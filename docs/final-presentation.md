# Final Pitch & Presentation Guide
**Codex Community Hackathon — bKash presents SUST CSE Carnival 2026**

This document serves as the pitching guide and slide deck outline to showcase the **Multi-Provider Super Agent Liquidity Intelligence Platform** to the judges.

---

## 1. Slide Deck Outline

### Slide 1: Title & Hook
- **Slide Title**: Super-Agent Liquidity Intelligence Portal (SALI)
- **Subtitle**: Multi-Wallet Coordination and Risk Forecasting for Shared Cash Outlets
- **Visuals**: A high-contrast premium UI render showing overlapping provider wallets (bKash, Nagad, Rocket) merging into a unified physical shop drawer.
- **Presenter Script**: 
  > "Mobile financial services are booming, and agents are the backbone. But many busy outlets are 'super agents' serving bKash, Nagad, and Rocket simultaneously. They have one physical cash drawer, but three separate digital wallets. Today, we present SALI—the first intelligent dashboard that solves the hidden liquidity shortage before service breaks down."

### Slide 2: The Problem (The "Eid Eve" Dilemma)
- **Points**:
  - **Provider Silos**: Outlets look wealthy in aggregate but are depleted on the specific provider customers want.
  - **Manual Monitoring**: Agents have to open multiple apps or logbooks to check e-money balances and cash velocity.
  - **Data Feeds Delay**: Intermittent API lags from different providers create stale balance representations.
  - **No Coordinated Response**: When suspicious activity happens, field officers, risk analysts, and provider ops don't coordinate, leading to delayed escalations.
- **Presenter Script**:
  > "Imagine a busy market on the afternoon before Eid. The shop has BDT 300,000 in total value. But bKash has only BDT 5,000 left. Customers line up to cash-in, but the agent must turn them away. Total value looked fine, but provider-level imbalance caused service disruption. When the agent tries to solve it, there's no coordination path."

### Slide 3: The Solution (SALI Framework)
- **Points**:
  - **Unified Real-time Views**: Aggregates shared cash and digital provider wallets in a single premium dashboard.
  - **Predictive Burn-rate Forecasts**: Dynamically calculates the remaining lead time (ETA to depletion) in plain English and Bengali.
  - **Hybrid AI Anomaly Engine**: Combines scikit-learn's IsolationForest with Gemini 2.5 Flash for trilingual explanations (English, Bangla, Banglish).
  - **Coordinated Operations room**: Role-based routing state machine with a read-only audit log trail for resolution.
- **Presenter Script**:
  > "SALI resolves this with three pillars: First, a Unified View of cash and e-money. Second, predictive burn-rate alerts that give advance warnings. Third, a coordinated ops control room that routes incidents and tracks resolution audits. Crucially, we maintain strict provider boundaries—never auto-converting or mixing wallets."

### Slide 4: System Architecture & Technologies
- **Points**:
  - **Frontend**: Vite + React, styled with vanilla Glassmorphic CSS.
  - **Backend**: FastAPI Gateway, async routers, PostgreSQL DB, SQLAlchemy.
  - **Machine Learning**: IsolationForest trained on a 7-day normal baseline (contamination=0.03) with a StandardScaler pre-processing pipeline.
  - **AI Integration**: Trilingual LLM Advisor (Gemini 2.5 / GPT-4o-mini / Local fallback) with persistent JSON caching ($0 cost for pre-run scenarios).
- **Presenter Script**:
  > "Our architecture is built for scale. An async FastAPI gateway processes incoming streams. Transactions are scaled using a StandardScaler and evaluated by an IsolationForest anomaly detector. We use a trilingual advisory chain that provides warnings in English, native Bengali, and colloquial Banglish. To reduce API cost, we implemented a persistent cache."

### Slide 5: Live Demo Tour (4 Story Scenarios)
- **Pillar 1: Scenario A — The Hidden Shortage (Agent A001)**
  - *Show*: Sajib Telecom has BDT 150,000 cash, but bKash is depleted. Highlight the burn-rate warn panel: **"bKash e-money running out in ~6 mins"**.
- **Pillar 2: Scenario B — Cash Drain & Anomaly (Agent A002)**
  - *Show*: Mayer Doa Enterprise cash box drains to BDT 8,000. Highlight the 5 identical BDT 9,999 transactions. Show the **Anomaly Badge (Requires Review)** and its evidence.
- **Pillar 3: Scenario C — Delayed Feeds & Uncertainty (Agent A003)**
  - *Show*: Riyad Variety Store. Rocket feed is 3 hours delayed. Show how forecast confidence falls to 15% to alert the user of feed inconsistency.
- **Pillar 4: Scenario D — Case Escalation (Ops Control Room)**
  - *Show*: Acknowledge, escalate, and resolve a case. Show the real-time **Case Coordination Audit Trail** tracking timeline events.
- **Presenter Script**:
  > "Let's walk through the working prototype. Scenario A shows the hidden provider shortage—bKash is running dry and triggers a warnings banner. Scenario B shows a physical cash shortage combined with a cluster of five identical transactions. In the Ops tab, we can route, acknowledge, and resolve this case. Notice the uncompromised audit trail tracking the timeline."

### Slide 6: Live Validation & Performance
- **Points**:
  - **Anomaly Precision**: 100% on injected suspect patterns.
  - **False Positive Rate**: <3% on baseline normal history.
  - **Forecast Lead Time**: Warns operators up to 12 minutes in advance.
  - **API Latency**: Measured live DB queries running under 5ms.
- **Presenter Script**:
  > "We validate our engineering quality. Clicking the Validation Metrics drawer reveals live-measured metrics: our false positive rate is under 3%, forecast lead time gives ample warning, and our API gateway handles database queries in less than 5 milliseconds."

### Slide 7: Why SALI Wins (Hackathon Value Proposition)
- **Points**:
  - **Strict Boundaries**: Adheres to financial guidelines—no unauthorized wallet refilling or fund transfers.
  - **Human-in-the-Loop**: Anomaly scores are advisory flags, not absolute fraud verdicts, avoiding unsupported profiling.
  - **Trilingual Accessibility**: Plain English, standard Bengali, and SMS-friendly Banglish support field officers and agents equally.
  - **Cost-efficient**: Cached LLM advice keeps operational cloud costs at zero for recurring scenarios.
- **Presenter Script**:
  > "SALI is built for the real world. We enforce advisory boundaries—we do not auto-block users or claim fraud. Our trilingual alerts speak the user's language, whether it's standard English, native Bengali, or Banglish text message. SALI is stable, responsible, and ready for deployment."

---

## 2. Expected Judges' Questions & Strategy

### Q1: "Why not just auto-transfer balances from Rocket or Nagad to cover bKash when it runs out?"
- **Strategic Answer**: 
  > "Auto-converting or settling balances across separate providers violates legal and regulatory frameworks. Agents operate separate legal agreements with bKash, Nagad, and Rocket. SALI strictly respects these provider boundaries and avoids auto-settlement, instead highlighting the imbalance so the agent or provider operations can coordinate manual bank settlements or physical rebalancing."

### Q2: "An IsolationForest model flags anomalies, but how do you prevent false positives from blocking genuine customer transactions?"
- **Strategic Answer**:
  > "SALI is designed as a decision-support system, not an automated gatekeeper. The anomaly engine flags transactions as 'Requires Review' to prompt human inspection, but it never automatically blocks accounts or disrupts transaction processing. This preserves the 'Human-in-the-Loop' guardrail outlined in the challenge guidelines, preventing algorithmic bias from locking out genuine customers during high-demand festival periods."

### Q3: "What happens if the agent's internet connection fails or the Gemini API is offline?"
- **Strategic Answer**:
  > "The prototype features a resilient fallback architecture. If the internet or AI models are offline, SALI falls back dynamically: first to OpenAI, and then to local deterministic translation dictionaries and rule-based calculations. The forecasting algorithm and IsolationForest model run entirely locally on the server. The application remains fully stable and functional even in complete offline isolation."

### Q4: "How does the system calculate the forecasting lead time and burn rate?"
- **Strategic Answer**:
  > "The forecasting engine aggregates transactions into 15-minute rolling windows to compute the current net transaction volume velocity (burn rate). It then projects this rate against the current wallet balance to calculate the estimated minutes until depletion. If feed latency is detected, it automatically penalizes the forecast confidence index, representing the uncertainty transparently to the user."
