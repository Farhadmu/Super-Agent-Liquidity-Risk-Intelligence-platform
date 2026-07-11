from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Dict, Any
from backend.app.models.database import get_db
from backend.app.models.schemas import Agent, Provider, ProviderBalance, CashPosition, AnomalyFlag
from backend.app.services.liquidity import compute_liquidity_forecast

router = APIRouter(prefix="/agents", tags=["agents"])

@router.get("/{agent_id}/overview")
def get_agent_overview(agent_id: int, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Shared cash pool balance (latest)
    cash_pos = db.query(CashPosition).filter(
        CashPosition.agent_id == agent_id
    ).order_by(desc(CashPosition.recorded_at)).first()
    shared_cash = float(cash_pos.amount) if cash_pos else 0.0

    # Provider e-money balances
    balances = []
    providers = db.query(Provider).all()
    for p in providers:
        bal_record = db.query(ProviderBalance).filter(
            ProviderBalance.agent_id == agent_id,
            ProviderBalance.provider_id == p.id
        ).order_by(desc(ProviderBalance.recorded_at)).first()
        
        # Check if the balance is delayed (Scenario C: Rocket for Agent A003)
        # Agent A003 is agent_id 3, Rocket is provider_id 3
        is_delayed = False
        if agent.agent_code == "A003" and p.name == "Rocket":
            is_delayed = True
            
        balances.append({
            "provider_id": p.id,
            "provider_name": p.name,
            "display_color": p.display_color,
            "balance": float(bal_record.balance) if bal_record else 0.0,
            "last_updated": bal_record.recorded_at.isoformat() if bal_record else None,
            "is_delayed": is_delayed
        })

    return {
        "agent_id": agent.id,
        "agent_code": agent.agent_code,
        "area": agent.area,
        "thana": agent.thana,
        "district": agent.district,
        "shared_cash": shared_cash,
        "provider_balances": balances
    }

@router.get("/{agent_id}/liquidity-forecast")
def get_agent_liquidity_forecast(agent_id: int, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    forecasts = []

    # 1. Shared cash pool forecast
    cash_forecast = compute_liquidity_forecast(db, agent_id, provider_id=None)
    forecasts.append({
        "provider_id": None,
        "provider_name": "Shared Cash",
        "display_color": "#4B5563", # Gray
        "risk_level": cash_forecast["risk_level"],
        "eta_minutes": cash_forecast["eta_minutes"],
        "confidence": cash_forecast["confidence"],
        "reason": cash_forecast["reason"],
        "current_balance": cash_forecast["current_balance"]
    })

    # 2. Per-provider e-money forecasts
    providers = db.query(Provider).all()
    for p in providers:
        # Check for Scenario C: Agent A003 Rocket data feed delay
        data_lag = False
        if agent.agent_code == "A003" and p.name == "Rocket":
            data_lag = True
            
        p_forecast = compute_liquidity_forecast(db, agent_id, provider_id=p.id, data_lag_simulation=data_lag)
        forecasts.append({
            "provider_id": p.id,
            "provider_name": p.name,
            "display_color": p.display_color,
            "risk_level": p_forecast["risk_level"],
            "eta_minutes": p_forecast["eta_minutes"],
            "confidence": p_forecast["confidence"],
            "reason": p_forecast["reason"],
            "current_balance": p_forecast["current_balance"]
        })

    return {
        "agent_id": agent_id,
        "agent_code": agent.agent_code,
        "forecasts": forecasts
    }

@router.get("/{agent_id}/anomalies")
def get_agent_anomalies(agent_id: int, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    flags = db.query(AnomalyFlag).filter(
        AnomalyFlag.agent_id == agent_id
    ).order_by(desc(AnomalyFlag.created_at)).all()

    res = []
    for f in flags:
        provider = db.query(Provider).filter(Provider.id == f.provider_id).first()
        res.append({
            "id": f.id,
            "provider_id": f.provider_id,
            "provider_name": provider.name if provider else "Unknown",
            "display_color": provider.display_color if provider else "#4B5563",
            "pattern_type": f.pattern_type,
            "anomaly_score": float(f.anomaly_score),
            "evidence": f.evidence,
            "confidence": float(f.confidence),
            "created_at": f.created_at.isoformat()
        })
    return res
