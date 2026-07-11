# Data and Simulation Note

This document explains the design, generation, and scenarios seeded for the **Multi-Provider Super Agent** prototype.

---

## 1. Baseline Generation (Normal Behavior)
- **Normal History**: 7 days of historical transaction logs are generated per agent.
- **Normal Distributions**:
  - Transaction amounts are normally distributed around $5,000$ BDT (standard deviation $1,500$ BDT, clipped between $500$ and $15,000$ BDT).
  - Transaction frequency follows a Poisson process with low rates during business hours (9 AM to 10 PM) and near-zero rates during late-night off-hours.
  - Counterparty repetition and identical amounts are rare ($<1$ count per 30 minutes).
- **IsolationForest Training**:
  - The model trains on this 7-day normal baseline ($1,500$ records) with a contamination parameter of $0.03$. 
  - This baseline establishes the "normal envelope" for transaction size, time of day, velocity, amount similarity, and counterparty frequency.

---

## 2. Seeded Demonstration Scenarios

### Scenario A: Hidden Provider Shortage (Agent A001)
- **Concept**: Total combined wallet balance looks high, but a single provider's e-money is depleted.
- **Implementation**:
  - Cash pool is set to $150,000$ BDT. Nagad is $80,000$ BDT, Rocket is $60,000$ BDT. bKash is only $5,000$ BDT.
  - In the last hour, 10 rapid `cash_in` transactions are generated on bKash. Since a cash-in requires the agent to send out bKash e-money, this rapidly depletes the bKash balance.
  - The forecaster calculates a high net burn rate, generating a `high-risk` shortage forecast with an ETA of ~6 minutes, warning the agent in English and Bengali.

### Scenario B: Shared Cash Shortage with Anomaly (Agent A002)
- **Concept**: Rapid cash depletion due to high cash-out demand, combined with anomalous identical transactions.
- **Implementation**:
  - Physical cash box starts at $80,000$ BDT and is drained down to $8,000$ BDT because of rapid cash-out requests.
  - We inject a suspicious cluster: 5 transactions of exactly $9,999$ BDT in a 15-minute window, all originating from a single repeated account ID (`CUST_SUSPECT`).
  - This triggers **both** a shared cash shortage warning (due to velocity of cash drain) and multiple high-confidence anomaly flags (velocity spike + near-identical clustering + repeated counterparty) in the Ops case queue.

### Scenario C: Data Inconsistency & Delay (Agent A003)
- **Concept**: Outdated or inconsistent provider feeds decrease forecast confidence.
- **Implementation**:
  - Rocket balance is set to record 3 hours ago (simulating feed delay).
  - The forecaster detects this latency, flags the feed as delayed, caps the confidence score at $15\%$, and warns the agent to consult manual banking records.

### Scenario D: Prior Case Escalation Timeline (Agent A004)
- **Concept**: Pre-seeded audit history for coordinating cases.
- **Implementation**:
  - A case is pre-seeded for Agent A004. Its status is set to `acknowledged`.
  - It carries an audit timeline with multiple events (acknowledged by Tanvir, note added about waiting for bank transfer), demonstrating to judges how the coordination timeline renders over time.

---

## 3. Assumptions and Limitations
- **Data Completeness**: The simulation assumes that all transactions are captured immediately. Real-world delays are represented only through the Scenario C flag.
- **Global vs. Local Model**: IsolationForest is trained globally on normal baseline behaviors. In production, models would benefit from per-agent customization to learn specific regional behaviors (e.g., city center vs. rural post office).
