from sqlalchemy.orm import Session
from backend.app.models.schemas import Provider, ProviderBalance, CashPosition
from backend.app.services.liquidity import compute_liquidity_forecast

def get_rebalance_recommendations(db: Session, agent_id: int):
    """
    Analyzes current balances and forecast states across all liquidity pools for an agent,
    generating clear, actionable rebalancing recommendations.
    """
    providers = db.query(Provider).all()
    
    # 1. Gather all current positions and forecasts
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
            "eta_minutes": forecast["eta_minutes"],
            "reason": forecast["reason"],
            "display_color": p.display_color
        })

    recommendations = []

    # 2. Heuristics for rebalancing recommendations
    
    # Identify deficits and surpluses
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
                    "suggested_amount": round(amount_to_refill, -3), # Round to nearest thousand
                    "action_text": f"Coordinate physical cash delivery of BDT {round(amount_to_refill, -3):,} using local merchant clearing or deposit from {best_surplus['name']} surplus wallet.",
                    "urgency": "high" if cash_pool["risk_level"] == "high" else "medium"
                })

    # Rule B: Cross-wallet e-money rebalancing (One MFS wallet low, another MFS wallet high)
    emoney_deficits = [p for p in deficits if p["provider_id"] is not None]
    emoney_surpluses = [p for p in surpluses if p["provider_id"] is not None]
    
    for def_pool in emoney_deficits:
        if emoney_surpluses:
            best_surplus = max(emoney_surpluses, key=lambda x: x["balance"])
            # Rebalance up to half of the surplus, rounded to nearest 5k
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
            # No e-money surpluses; suggest bank top-up if cash box is in surplus
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

    # Rule C: All systems are stable
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
        "summary": f"Generated {len(recommendations)} liquidity rebalancing suggestions."
    }
