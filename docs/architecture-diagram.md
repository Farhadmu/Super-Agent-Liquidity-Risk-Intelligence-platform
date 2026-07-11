# Technical Architecture Diagram

This document details the software architecture, data flows, and analytical pipelines of the **Multi-Provider Super Agent** system.

---

## 1. System Flowchart

The following diagram illustrates how transaction events flow into the PostgreSQL database, trigger the liquidity forecasting and IsolationForest anomaly detectors, and populate the operations case coordination queue.

```mermaid
graph TD
    %% Frontend Layer
    subgraph Frontend [React Frontend - Port 3000]
        AV[Agent View: Balances, ETA Alerts, Bilingual Alerts]
        OV[Ops Control View: Case Queue, Timeline, Case Actions]
        MP[Metrics Pane: Analytics & Latency Reports]
    end

    %% Gateway Layer
    subgraph API [FastAPI Gateway - Port 8000]
        AR[Agents Router: /overview, /forecasts, /anomalies]
        CR[Cases Router: /acknowledge, /escalate, /resolve, /notes]
        MR[Metrics Router: /validation]
        SR[Simulator Router: /seed]
    end

    %% Processing Layer
    subgraph Processing [Services & ML Pipeline]
        LF[Liquidity Forecast: Rolling Burn Rate & Confidence]
        IF[Anomaly Detection: IsolationForest & Feature Engineering]
        CO[Case Coordination: State Machine & Auto-Routing]
    end

    %% Data Layer
    subgraph Data [PostgreSQL Database - Port 5432]
        DB_A[(agents)]
        DB_T[(transactions)]
        DB_B[(provider_balances)]
        DB_F[(liquidity_forecasts)]
        DB_AF[(anomaly_flags)]
        DB_C[(cases)]
        DB_E[(case_events)]
    end

    %% Connections
    AV -->|HTTP GET| AR
    OV -->|HTTP GET/POST| CR
    MP -->|HTTP GET| MR
    
    AR --> LF
    AR --> IF
    CR --> CO
    
    LF -->|Read/Write| DB_T
    LF -->|Read/Write| DB_B
    LF -->|Write| DB_F
    
    IF -->|Read| DB_T
    IF -->|Write| DB_AF
    
    CO -->|Write| DB_C
    CO -->|Write| DB_E
    
    SR -->|Trigger Seed| Data
    
    style Frontend fill:#111827,stroke:#3B82F6,stroke-width:2px,color:#fff
    style API fill:#1F2937,stroke:#10B981,stroke-width:2px,color:#fff
    style Processing fill:#111827,stroke:#F59E0B,stroke-width:2px,color:#fff
    style Data fill:#1F2937,stroke:#EF4444,stroke-width:2px,color:#fff
```

---

## 2. Core Components

1. **FastAPI Gateway**: Serves as a single entry point. Standardizes CORS headers for React integration and auto-creates schemas on startup.
2. **Liquidity Forecast Service**: 
   - Buckets transaction history into 15-minute intervals.
   - Calculates depletion rate per minute.
   - Adjusts confidence down when data feeds are delayed (Scenario C).
3. **IsolationForest Anomaly Detector**:
   - Performs transaction-level feature engineering (velocity, clustering, proximity to historical means).
   - Generates advisory flags with strict evidence context (never blocks transaction pipelines directly).
4. **Case Coordination engine**:
   - Manages state changes.
   - Employs routing rules to assign cases to their respective team roles.
   - Logs every timeline action to a read-only audit log table.
