import os
import pickle
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.models.schemas import Transaction, AnomalyFlag

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "ml", "isolation_forest.pkl")

def get_historical_mean(db: Session, agent_id: int):
    """Get the average transaction amount for the agent."""
    result = db.query(func.avg(Transaction.amount)).filter(
        Transaction.agent_id == agent_id,
        Transaction.status == 'completed'
    ).scalar()
    return float(result) if result else 5000.0 # Default fallback

def get_recent_stats(db: Session, agent_id: int, tx_amount: float, tx_time: datetime, counterparty_ref: str):
    """
    Computes velocity, amount similarity, and counterparty repetition in recent window.
    """
    time_10m = tx_time - timedelta(minutes=10)
    time_30m = tx_time - timedelta(minutes=30)

    # 1. Velocities
    vel_10 = db.query(func.count(Transaction.id)).filter(
        Transaction.agent_id == agent_id,
        Transaction.created_at >= time_10m,
        Transaction.created_at <= tx_time
    ).scalar() or 0

    vel_30 = db.query(func.count(Transaction.id)).filter(
        Transaction.agent_id == agent_id,
        Transaction.created_at >= time_30m,
        Transaction.created_at <= tx_time
    ).scalar() or 0

    # 2. Amount similarity (within 2% range in last 30 minutes)
    lower_bound = tx_amount * 0.98
    upper_bound = tx_amount * 1.02
    sim_count = db.query(func.count(Transaction.id)).filter(
        Transaction.agent_id == agent_id,
        Transaction.created_at >= time_30m,
        Transaction.created_at <= tx_time,
        Transaction.amount >= lower_bound,
        Transaction.amount <= upper_bound
    ).scalar() or 0

    # 3. Counterparty repetition count in last 30 mins
    rep_count = 0
    if counterparty_ref:
        rep_count = db.query(func.count(Transaction.id)).filter(
            Transaction.agent_id == agent_id,
            Transaction.created_at >= time_30m,
            Transaction.created_at <= tx_time,
            Transaction.counterparty_ref == counterparty_ref
        ).scalar() or 0

    return vel_10, vel_30, sim_count, rep_count

def extract_features_for_tx(db: Session, tx: Transaction):
    """Extract the 7 features needed for IsolationForest prediction."""
    amount = float(tx.amount)
    mean_amount = get_historical_mean(db, tx.agent_id)
    dev_amount = amount - mean_amount

    tx_time = tx.created_at or datetime.utcnow()
    vel_10, vel_30, sim_count, rep_count = get_recent_stats(
        db, tx.agent_id, amount, tx_time, tx.counterparty_ref
    )

    local_tx_time = tx_time + timedelta(hours=6)  # Demo data is interpreted in Bangladesh local time.
    off_hours = 1 if (local_tx_time.hour < 9 or local_tx_time.hour >= 22) else 0

    features = [
        amount,
        dev_amount,
        float(vel_10),
        float(vel_30),
        float(sim_count),
        float(rep_count),
        float(off_hours)
    ]
    
    # Store evidence metadata dictionary for explainability
    evidence = {
        "transaction_id": tx.id,
        "amount": amount,
        "historical_mean": round(mean_amount, 2),
        "amount_deviation": round(dev_amount, 2),
        "velocity_10m": vel_10,
        "velocity_30m": vel_30,
        "similar_amounts_30m": sim_count,
        "counterparty_repetition_30m": rep_count,
        "off_hours_activity": bool(off_hours),
        "timestamp": tx_time.isoformat()
    }

    return features, evidence

def check_transaction_for_anomaly(db: Session, tx: Transaction) -> AnomalyFlag:
    """
    Checks a transaction for anomalies using the saved IsolationForest model.
    Saves and returns an AnomalyFlag if flagged.
    """
    if not os.path.exists(MODEL_PATH):
        # Fallback heuristic if ML model is not trained/saved yet
        features, evidence = extract_features_for_tx(db, tx)
        is_anomaly = False
        reason_type = "normal"
        confidence = 0.50
        
        # Rule-based fallback
        if evidence["counterparty_repetition_30m"] >= 4:
            is_anomaly = True
            reason_type = "repeated_counterparty"
            confidence = 0.75
        elif evidence["similar_amounts_30m"] >= 4:
            is_anomaly = True
            reason_type = "near_identical_amounts"
            confidence = 0.70
        elif evidence["velocity_10m"] >= 5:
            is_anomaly = True
            reason_type = "velocity_spike"
            confidence = 0.80
        elif evidence["off_hours_activity"] and evidence["amount"] > 15000:
            is_anomaly = True
            reason_type = "off_hours_activity"
            confidence = 0.65
            
        if is_anomaly:
            # continuous anomaly score placeholder
            anomaly_score = 0.85 
            flag = AnomalyFlag(
                agent_id=tx.agent_id,
                provider_id=tx.provider_id,
                pattern_type=reason_type,
                anomaly_score=anomaly_score,
                evidence=evidence,
                confidence=confidence,
                created_at=datetime.utcnow()
            )
            db.add(flag)
            db.commit()
            db.refresh(flag)
            return flag
        return None

    # ML IsolationForest implementation
    try:
        with open(MODEL_PATH, "rb") as f:
            saved_data = pickle.load(f)
        
        features, evidence = extract_features_for_tx(db, tx)
        
        if isinstance(saved_data, dict):
            model = saved_data["model"]
            scaler = saved_data["scaler"]
            X_scaled = scaler.transform([features])
        else:
            model = saved_data
            X_scaled = np.array([features])
        
        # Predict: -1 = anomaly, 1 = normal
        pred = model.predict(X_scaled)[0]
        # decision_function returns signed distance. The lower, the more abnormal.
        raw_score = model.decision_function(X_scaled)[0]
        
        # Normalize anomaly score to [0.0, 1.0] range where higher means more anomalous
        # decision_function usually returns positive for normal, negative for anomalies
        normalized_score = float(1.0 / (1.0 + np.exp(raw_score * 5))) # Logistic scaling

        has_review_pattern = (
            evidence["counterparty_repetition_30m"] >= 4
            or evidence["similar_amounts_30m"] >= 4
            or evidence["velocity_10m"] >= 5
            or (evidence["off_hours_activity"] and evidence["amount"] > 15000)
        )

        if (pred == -1 or normalized_score > 0.65) and has_review_pattern:
            # Determine pattern type based on evidence values
            pattern_type = "unusual_transaction_amount"
            confidence = round(normalized_score * 0.95, 2)
            
            if evidence["counterparty_repetition_30m"] >= 4:
                pattern_type = "repeated_counterparty"
            elif evidence["similar_amounts_30m"] >= 4:
                pattern_type = "near_identical_amounts"
            elif evidence["velocity_10m"] >= 5 or evidence["velocity_30m"] >= 10:
                pattern_type = "velocity_spike"
            elif evidence["off_hours_activity"]:
                pattern_type = "off_hours_activity"

            flag = AnomalyFlag(
                agent_id=tx.agent_id,
                provider_id=tx.provider_id,
                pattern_type=pattern_type,
                anomaly_score=normalized_score,
                evidence=evidence,
                confidence=confidence,
                created_at=datetime.utcnow()
            )
            db.add(flag)
            db.commit()
            db.refresh(flag)
            return flag
    except Exception as e:
        print(f"Error running IsolationForest model: {e}")
        
    return None
