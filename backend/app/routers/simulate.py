from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timedelta
from decimal import Decimal

from backend.app.models.database import get_db
from backend.app.models.schemas import Provider, Agent, ProviderBalance, Transaction, LiquidityForecast, CashPosition
from backend.app.simulator.generate_data import seed_database
from backend.app.services.liquidity import compute_liquidity_forecast
from backend.app.services.anomaly import check_transaction_for_anomaly
from backend.app.services.coordination import create_case_from_alert

router = APIRouter(prefix="/simulate", tags=["simulate"])

class CustomScenarioInput(BaseModel):
    agent_id: int
    shared_cash: float
    bkash_balance: float
    nagad_balance: float
    rocket_balance: float
    bkash_delayed: bool = False
    nagad_delayed: bool = False
    rocket_delayed: bool = False
    
    inject_anomaly: bool = False
    anomaly_amount: float = 9999.0
    anomaly_count: int = 5
    anomaly_counterparty: str = "CUST_CUSTOM"
    anomaly_type: str = "cash_out"

@router.post("/seed")
def trigger_seed(background_tasks: BackgroundTasks):
    background_tasks.add_task(seed_database)
    return {"status": "success", "message": "Database seeding triggered. Re-building schemas, training IsolationForest, and regenerating scenarios."}

@router.post("/custom-scenario")
def apply_custom_scenario(payload: CustomScenarioInput, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == payload.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # 1. Update shared cash pool balance (CashPosition)
    cash_pos = CashPosition(
        agent_id=agent.id,
        amount=Decimal(f"{payload.shared_cash:.2f}"),
        recorded_at=datetime.utcnow()
    )
    db.add(cash_pos)

    # Helper to update provider balance
    def update_provider_balance(provider_name: str, balance_val: float, is_delayed: bool):
        provider = db.query(Provider).filter(Provider.name.ilike(provider_name)).first()
        if not provider:
            return None
        
        bal_record = db.query(ProviderBalance).filter(
            ProviderBalance.agent_id == agent.id,
            ProviderBalance.provider_id == provider.id
        ).first()
        
        recorded_at = datetime.utcnow()
        if is_delayed:
            recorded_at = datetime.utcnow() - timedelta(hours=3)

        if bal_record:
            bal_record.balance = Decimal(f"{balance_val:.2f}")
            bal_record.recorded_at = recorded_at
        else:
            bal_record = ProviderBalance(
                agent_id=agent.id,
                provider_id=provider.id,
                balance=Decimal(f"{balance_val:.2f}"),
                recorded_at=recorded_at
            )
            db.add(bal_record)
        return provider

    bkash = update_provider_balance("bKash", payload.bkash_balance, payload.bkash_delayed)
    nagad = update_provider_balance("Nagad", payload.nagad_balance, payload.nagad_delayed)
    rocket = update_provider_balance("Rocket", payload.rocket_balance, payload.rocket_delayed)
    db.commit()

    # 2. Inject custom transaction burst (Anomaly) if requested
    injected_txs = []
    if payload.inject_anomaly and payload.anomaly_count > 0:
        target_provider = bkash or db.query(Provider).first()
        now = datetime.utcnow()
        
        for i in range(payload.anomaly_count):
            tx_time = now - timedelta(minutes=(payload.anomaly_count - i) * 2)
            tx = Transaction(
                agent_id=agent.id,
                provider_id=target_provider.id,
                tx_type=payload.anomaly_type,
                amount=Decimal(f"{payload.anomaly_amount:.2f}"),
                counterparty_ref=payload.anomaly_counterparty,
                status='completed',
                created_at=tx_time
            )
            db.add(tx)
            db.commit()
            db.refresh(tx)
            injected_txs.append(tx)

    # 3. Trigger IsolationForest anomaly evaluation on injected transactions
    flagged_count = 0
    for tx in injected_txs:
        flag = check_transaction_for_anomaly(db, tx.id)
        if flag:
            flagged_count += 1
            recommended_action = f"Review custom transaction pattern. Verify identity for counterparty {payload.anomaly_counterparty}."
            create_case_from_alert(
                db=db,
                source_type="anomaly",
                source_id=flag.id,
                agent_id=agent.id,
                provider_id=flag.provider_id,
                severity="review",
                recommended_action=recommended_action
            )

    # 4. Trigger liquidity forecast run and route cases
    fc_cash = compute_liquidity_forecast(db, agent.id, provider_id=None)
    fc_cash_db = LiquidityForecast(
        agent_id=agent.id,
        provider_id=None,
        risk_level=fc_cash["risk_level"],
        eta_minutes=fc_cash["eta_minutes"],
        confidence=Decimal(f"{fc_cash['confidence']:.2f}"),
        reason=fc_cash["reason"],
        computed_at=datetime.utcnow()
    )
    db.add(fc_cash_db)
    db.commit()
    db.refresh(fc_cash_db)
    
    if fc_cash["risk_level"] in ["high", "medium"]:
        create_case_from_alert(
            db=db,
            source_type="liquidity",
            source_id=fc_cash_db.id,
            agent_id=agent.id,
            provider_id=None,
            severity="urgent" if fc_cash["risk_level"] == "high" else "review",
            recommended_action="Physical cash box is low. Instruct cash transfer or coordinate area rebalancing."
        )

    for prov in [bkash, nagad, rocket]:
        if not prov:
            continue
        fc_prov = compute_liquidity_forecast(db, agent.id, provider_id=prov.id)
        fc_prov_db = LiquidityForecast(
            agent_id=agent.id,
            provider_id=prov.id,
            risk_level=fc_prov["risk_level"],
            eta_minutes=fc_prov["eta_minutes"],
            confidence=Decimal(f"{fc_prov['confidence']:.2f}"),
            reason=fc_prov["reason"],
            computed_at=datetime.utcnow()
        )
        db.add(fc_prov_db)
        db.commit()
        db.refresh(fc_prov_db)
        
        if fc_prov["risk_level"] in ["high", "medium"]:
            create_case_from_alert(
                db=db,
                source_type="liquidity",
                source_id=fc_prov_db.id,
                agent_id=agent.id,
                provider_id=prov.id,
                severity="urgent" if fc_prov["risk_level"] == "high" else "review",
                recommended_action=f"Replenish {prov.name} e-money wallet. Coordinate electronic transfer."
            )

    return {
        "status": "success",
        "message": f"Custom scenario applied for Agent {agent.agent_code}.",
        "details": {
            "shared_cash": float(agent.shared_cash),
            "injected_transactions": len(injected_txs),
            "flagged_anomalies": flagged_count
        }
    }
