from sqlalchemy.orm import Session
from sqlalchemy import desc
from backend.app.models.schemas import Provider, ProviderBalance, CashPosition, Agent
from backend.app.services.liquidity import compute_liquidity_forecast

def get_nearby_agent_support(db: Session, agent_id: int):
    """
    Finds nearby agents in the same District/Thana that have balance surpluses
    and can offer peer-to-peer liquidity support.
    """
    # 1. Fetch current agent details
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        return []
        
    # 2. Find other agents in the same district/thana
    other_agents = db.query(Agent).filter(
        Agent.id != agent_id,
        Agent.district == agent.district
    ).all()
    
    support_options = []
    for other in other_agents:
        # Check cash position
        pos = db.query(CashPosition).filter(CashPosition.agent_id == other.id).order_by(desc(CashPosition.recorded_at)).first()
        cash_balance = float(pos.amount) if pos else 0.0
        
        # Determine distance label based on area closeness
        if other.area == agent.area:
            distance = "250m"
        elif other.thana == agent.thana:
            distance = "600m"
        else:
            distance = "1.2km"
            
        surpluses = []
        if cash_balance > 50000.0:
            surpluses.append({"asset": "Physical Cash", "balance": cash_balance})
            
        # Provider electronic balances
        bals = db.query(ProviderBalance).filter(ProviderBalance.agent_id == other.id).all()
        for b in bals:
            prov = db.query(Provider).filter(Provider.id == b.provider_id).first()
            if prov and float(b.balance) > 40000.0:
                surpluses.append({"asset": prov.name, "balance": float(b.balance)})
                
        if surpluses:
            support_options.append({
                "agent_code": other.agent_code,
                "area": other.area,
                "distance": distance,
                "surpluses": surpluses
            })
            
    return support_options

def get_rebalance_recommendations(db: Session, agent_id: int):
    """
    Analyzes current balances and forecast states across all liquidity pools for an agent,
    generating clear, actionable rebalancing recommendations.
    """
    providers = db.query(Provider).all()
    pools = []
    
    # Check Shared Cash Pool
    cash_forecast = compute_liquidity_forecast(db, agent_id, provider_id=None)
    pools.append({
        "provider_id": None,
        "name": "Shared Cash",
        "balance": cash_forecast["current_balance"],
        "risk_level": cash_forecast["risk_level"],
        "eta_minutes": cash_forecast["eta_minutes"],
        "reason": cash_forecast["reason"]
    })
    
    # Check Provider E-money Wallets
    for p in providers:
        forecast = compute_liquidity_forecast(db, agent_id, provider_id=p.id)
        pools.append({
            "provider_id": p.id,
            "name": p.name,
            "balance": forecast["current_balance"],
            "risk_level": forecast["risk_level"],
            "status": forecast["risk_level"],
            "eta_minutes": forecast["eta_minutes"],
            "reason": forecast["reason"],
            "display_color": p.display_color
        })

    recommendations = []

    # Deficits and surpluses
    deficits = [pool for pool in pools if pool["risk_level"] in ["high", "medium"]]
    surpluses = [pool for pool in pools if pool["risk_level"] == "low" and pool["balance"] > 25000]

    # Rule A: Shared Cash is low, but e-money is in surplus
    cash_pool = next((p for p in pools if p["provider_id"] is None), None)
    if cash_pool and cash_pool["risk_level"] in ["high", "medium"]:
        emoney_surpluses = [p for p in surpluses if p["provider_id"] is not None]
        if emoney_surpluses:
            best_surplus = max(emoney_surpluses, key=lambda x: x["balance"])
            amount_to_refill = min(20000.0, best_surplus["balance"] - 15000.0)
            if amount_to_refill > 5000:
                recommendations.append({
                    "type": "cash_replenish",
                    "from_pool": best_surplus["name"],
                    "to_pool": "Shared Cash",
                    "suggested_amount": round(amount_to_refill, -3),
                    "action_text": f"Coordinate physical cash delivery of BDT {round(amount_to_refill, -3):,} using local merchant clearing or deposit from {best_surplus['name']} surplus wallet.",
                    "urgency": "high" if cash_pool["risk_level"] == "high" else "medium"
                })

    # Rule B: Cross-wallet e-money rebalancing
    emoney_deficits = [p for p in deficits if p["provider_id"] is not None]
    emoney_surpluses = [p for p in surpluses if p["provider_id"] is not None]
    
    for def_pool in emoney_deficits:
        if emoney_surpluses:
            best_surplus = max(emoney_surpluses, key=lambda x: x["balance"])
            suggested = min(15000.0, (best_surplus["balance"] - 10000.0) / 2.0)
            if suggested > 2000:
                recommendations.append({
                    "type": "wallet_swap",
                    "from_pool": best_surplus["name"],
                    "to_pool": def_pool["name"],
                    "suggested_amount": round(suggested, -3),
                    "action_text": f"Transfer BDT {round(suggested, -3):,} from surplus {best_surplus['name']} e-money wallet to low {def_pool['name']} wallet via Commercial Bank link.",
                    "urgency": "high" if def_pool["risk_level"] == "high" else "medium"
                })
        else:
            if cash_pool and cash_pool["risk_level"] == "low" and cash_pool["balance"] > 40000:
                suggested_dep = min(20000.0, cash_pool["balance"] - 20000.0)
                recommendations.append({
                    "type": "bank_deposit",
                    "from_pool": "Shared Cash",
                    "to_pool": def_pool["name"],
                    "suggested_amount": round(suggested_dep, -3),
                    "action_text": f"Bank deposit recommended: Deposit BDT {round(suggested_dep, -3):,} physical cash to MFS clearing bank to top-up low {def_pool['name']} wallet.",
                    "urgency": "medium"
                })

    # Rule C: All stable
    if not recommendations:
        recommendations.append({
            "type": "stable",
            "from_pool": None,
            "to_pool": None,
            "suggested_amount": 0,
            "action_text": "Liquidity is balanced across all provider wallets and shared cash pools. Continue monitoring.",
            "urgency": "low"
        })

    return {
        "agent_id": agent_id,
        "recommendations": recommendations,
        "nearby_support": get_nearby_agent_support(db, agent_id),
        "summary": f"Generated {len(recommendations)} liquidity rebalancing suggestions."
    }
