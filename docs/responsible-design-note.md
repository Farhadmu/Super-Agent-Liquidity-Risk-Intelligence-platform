# Responsible Design Note

This document outlines the ethical, privacy-preserving, and human-centric design choices implemented in the **Multi-Provider Super Agent** prototype.

---

## 1. Privacy-Preserving Synthetic Data
- **Zero Real Data Exposure**: All data in the system (agent codes, area names, and counterparty references) are purely synthetic. 
- **Anonymized Identifiers**:
  - Agent identities are represented by synthetic codes (e.g., `A001`, `A002`) instead of actual names or business records.
  - Counterparty details use hashed/anonymized strings (e.g., `CUST34892`, `CUST_SUSPECT`) to ensure that customer transaction history cannot be reverse-engineered or mapped to real-world individuals.

---

## 2. Advisory Boundaries & Human-in-the-Loop
- **No Automated Financial Action**:
  - The anomaly detection service does **not** make fraud determinations. It registers advisory flags (`Requires Review`) based on statistical evidence.
  - The system **never** blocks a user wallet, freezes funds, or auto-transitions a case to a financial penalty.
- **Traceable Human Coordination**:
  - All status transitions (from `open` to `acknowledged`, `escalated`, or `resolved`) require an explicit human actor (`actor_role` such as `provider_ops`, `field_officer`, `risk_analyst`).
  - Action auditing is enforced by the `case_events` schema, which acts as a permanent, read-only audit trail logging who took action, when, and why.

---

## 3. Explicit Uncertainty Representation
- **Confidence Metrics**:
  - Both liquidity forecasts and anomaly flags are presented with a confidence percentage rather than false precision.
  - If transaction volume is low or variance is high, confidence scores decrease, signaling to operators that they should proceed with caution.
- **Fail-Safe Fallbacks**:
  - If a provider data feed is delayed, late, or inconsistent (e.g., Scenario C), the system automatically reduces forecast confidence to a heavily penalized level (e.g., `15%`).
  - It alerts the user in clear, plain language (English + Bengali) that the feed is unreliable, preventing operators from acting on stale forecasts.

---

## 4. Strict Provider Siloing
- **No Cross-Provider Balance Movement**:
  - E-money balances are strictly partitioned by `provider_id`. The database schema contains no routes, columns, or triggers to convert or move balances across providers.
  - The Agent View consolidates the dashboard for the agent's display convenience, but the underlying accounts remain strictly isolated, respecting legal, security, and technical boundaries.

---

## 5. Non-Decision Chatbot Guardrails
- **No Automated Ticket Influx / Chat Analysis First**:
  - The chatbot does not blindly open tickets for every user message. It first analyzes the message's intent (e.g., separating casual greetings or trivial questions from real technical or operational blockages).
- **Prohibition of Final Declarations & Decisions**:
  - The AI chatbot is barred from making final decisions (e.g. approving cash delivery, updating limits) or final declarations/verdicts (e.g. declaring a transaction "completely safe" or "100% fraud").
  - The chatbot's role is restricted to gathering details, drafting a preliminary scenario report and recommendations for the human operators, and routing the ticket to the correct department. The chatbot explicitly notifies the agent that the final action requires human review and confirmation.
