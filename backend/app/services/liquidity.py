from datetime import datetime, timedelta
import numpy as np
from sqlalchemy import desc
from sqlalchemy.orm import Session
from backend.app.models.schemas import Transaction, ProviderBalance, CashPosition

def compute_liquidity_forecast(db: Session, agent_id: int, provider_id: int = None, hours_lookback: int = 4, data_lag_simulation: bool = False):
    """
    Computes liquidity forecast for an agent.
    If provider_id is None, it computes for the shared physical cash pool.
    Otherwise, it computes for that specific provider's e-money balance.
    """
    now = datetime.utcnow()
    start_time = now - timedelta(hours=hours_lookback)

    # 1. Get current balance
    if provider_id is None:
        # Physical cash position
        pos = db.query(CashPosition).filter(
            CashPosition.agent_id == agent_id
        ).order_by(desc(CashPosition.recorded_at)).first()
        current_balance = float(pos.amount) if pos else 0.0
    else:
        # Provider e-money balance
        bal = db.query(ProviderBalance).filter(
            ProviderBalance.agent_id == agent_id,
            ProviderBalance.provider_id == provider_id
        ).order_by(desc(ProviderBalance.recorded_at)).first()
        current_balance = float(bal.balance) if bal else 0.0

    # Absolute depletion guard (independent of transaction velocity)
    is_critical_depletion = False
    depletion_threshold = 0.0
    asset_name = ""
    if provider_id is None:
        if current_balance < 15000.0:
            is_critical_depletion = True
            depletion_threshold = 15000.0
            asset_name = "Physical cash"
    else:
        if current_balance < 5000.0:
            is_critical_depletion = True
            depletion_threshold = 5000.0
            asset_name = "E-money wallet"

    if is_critical_depletion:
        return {
            "risk_level": "high",
            "eta_minutes": 0,
            "confidence": 0.99,
            "reason": f"CRITICAL BALANCE DEPLETION: {asset_name} is critically depleted to {current_balance:.2f} BDT (below minimum safety limit of {depletion_threshold:.2f} BDT).",
            "current_balance": current_balance
        }

    # 2. Get transactions in the lookback window
    query = db.query(Transaction).filter(
        Transaction.agent_id == agent_id,
        Transaction.created_at >= start_time,
        Transaction.status == 'completed'
    )
    if provider_id is not None:
        query = query.filter(Transaction.provider_id == provider_id)
    
    txs = query.order_by(Transaction.created_at).all()

    # If simulated data lag/delay is active, we penalize confidence immediately (Scenario C)
    if data_lag_simulation:
        return {
            "risk_level": "low",
            "eta_minutes": None,
            "confidence": 0.15,
            "reason": "CONFIDENCE ALERT: Provider balance feeds are delayed. Cannot forecast safely.",
            "current_balance": current_balance
        }

    if not txs:
        return {
            "risk_level": "low",
            "eta_minutes": None,
            "confidence": 0.50,
            "reason": "No recent transaction data available for forecast. Assuming stable state.",
            "current_balance": current_balance
        }

    # 3. Bucket transactions into 15-minute windows
    # Total minutes in lookback window = hours_lookback * 60
    bucket_size_min = 15
    total_buckets = (hours_lookback * 60) // bucket_size_min
    buckets = [0.0] * total_buckets

    for tx in txs:
        # Time difference in minutes from start_time
        delta_min = (tx.created_at - start_time).total_seconds() / 60.0
        bucket_idx = int(delta_min // bucket_size_min)
        if 0 <= bucket_idx < total_buckets:
            amount = float(tx.amount)
            # Flow direction check
            if provider_id is None:
                # For shared cash:
                # cash_in = cash increases (inflow)
                # cash_out = cash decreases (outflow)
                if tx.tx_type == 'cash_out':
                    buckets[bucket_idx] -= amount # Outflow
                elif tx.tx_type == 'cash_in':
                    buckets[bucket_idx] += amount # Inflow
            else:
                # For e-money balance:
                # cash_in = customer wants e-money, so agent transfers e-money to customer (outflow for agent)
                # cash_out = customer gives e-money to agent, agent gives cash (inflow for agent)
                if tx.tx_type == 'cash_in':
                    buckets[bucket_idx] -= amount # Outflow
                elif tx.tx_type == 'cash_out':
                    buckets[bucket_idx] += amount # Inflow

    # 4. Compute average burn rate per minute
    # Burn rate is positive when the balance is decreasing (negative flow)
    negative_flows = [-flow for flow in buckets if flow < 0]
    
    # Use the active transaction window so a recent surge is not diluted across
    # quiet lookback hours. This keeps ETAs aligned with the live service pressure.
    total_net_flow = sum(buckets)
    active_span_minutes = (txs[-1].created_at - txs[0].created_at).total_seconds() / 60.0
    time_span_minutes = max(bucket_size_min, min(hours_lookback * 60, active_span_minutes))
    
    # Average change per minute
    avg_change_per_minute = total_net_flow / time_span_minutes
    avg_burn_rate_per_minute = -avg_change_per_minute if avg_change_per_minute < 0 else 0.0

    # 5. Project ETA
    eta_minutes = None
    if avg_burn_rate_per_minute > 0.001:
        eta_minutes = int(current_balance / avg_burn_rate_per_minute)
    
    # 6. Confidence scaling
    # Volatility of flows: standard deviation of flows across buckets
    flow_std = np.std(buckets) if len(buckets) > 1 else 0.0
    tx_count = len(txs)
    
    # Base confidence on transaction count
    if tx_count < 5:
        confidence = 0.40
    elif tx_count < 15:
        confidence = 0.65
    else:
        confidence = 0.85
    
    # Penalize confidence if flow standard deviation is high relative to mean
    if flow_std > 0:
        mean_abs_flow = np.mean([abs(f) for f in buckets])
        if mean_abs_flow > 0:
            coefficient_of_variation = flow_std / mean_abs_flow
            if coefficient_of_variation > 2.0:
                confidence -= 0.15
            elif coefficient_of_variation > 1.0:
                confidence -= 0.05
    
    confidence = max(0.10, min(0.99, confidence))
    
    # Round to 2 decimal places
    confidence = round(confidence, 2)

    # 7. Risk levels
    risk_level = "low"
    reason = "Balances are stable or increasing based on rolling average flow."
    
    if eta_minutes is not None:
        if eta_minutes < 120:
            risk_level = "high"
            reason = f"High depletion risk. Projected shortage in {eta_minutes} minutes due to high net burn rate."
        elif eta_minutes < 360:
            risk_level = "medium"
            reason = f"Moderate depletion risk. Projected shortage in {eta_minutes} minutes."
        else:
            risk_level = "low"
            reason = f"Balances are healthy. Projected shortage in {eta_minutes} minutes."

    return {
        "risk_level": risk_level,
        "eta_minutes": eta_minutes,
        "confidence": confidence,
        "reason": reason,
        "current_balance": current_balance
    }
