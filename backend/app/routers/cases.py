from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from typing import List, Optional
from backend.app.models.database import get_db
from backend.app.models.schemas import Case, Agent, Provider, CaseEvent, AnomalyFlag, LiquidityForecast, CashPosition, ProviderBalance
from backend.app.services.coordination import acknowledge_case, escalate_case, resolve_case, add_case_note, reassign_case
from backend.app.services.llm_advisor import generate_trilingual_alerts, analyze_agent_chat_message
from backend.app.routers.stream import broadcast_event
from datetime import datetime

router = APIRouter(prefix="/cases", tags=["cases"])

class AcknowledgeRequest(BaseModel):
    actor_role: str
    actor_name: str

class TransitionRequest(BaseModel):
    actor_role: str
    note: str

@router.get("")
def list_cases(
    status: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    provider: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Case)

    if status:
        query = query.filter(Case.status == status)
    if role:
        query = query.filter(Case.assigned_role == role)
    if provider is not None:
        query = query.filter(Case.provider_id == provider)

    cases = query.order_by(desc(Case.created_at)).all()

    results = []
    for c in cases:
        agent = db.query(Agent).filter(Agent.id == c.agent_id).first()
        provider_obj = db.query(Provider).filter(Provider.id == c.provider_id).first() if c.provider_id else None
        
        # Timeline events
        events_query = db.query(CaseEvent).filter(CaseEvent.case_id == c.id).order_by(CaseEvent.created_at).all()
        events = [{
            "id": e.id,
            "event_type": e.event_type,
            "actor_role": e.actor_role,
            "note": e.note,
            "created_at": e.created_at.isoformat()
        } for e in events_query]

        # Fetch original source details for explainability
        source_details = None
        explanation = None
        if c.source_type == "anomaly":
            flag = db.query(AnomalyFlag).filter(AnomalyFlag.id == c.source_id).first()
            if flag:
                source_details = {
                    "pattern_type": flag.pattern_type,
                    "anomaly_score": float(flag.anomaly_score) if flag.anomaly_score else 0.85,
                    "confidence": float(flag.confidence) if flag.confidence else 0.70,
                    "evidence": flag.evidence
                }
                details = {
                    "agent_code": agent.agent_code if agent else "Unknown",
                    "provider_name": provider_obj.name if provider_obj else "Shared Cash",
                    "pattern_type": flag.pattern_type,
                    "anomaly_score": float(flag.anomaly_score) if flag.anomaly_score else 0.85,
                    "confidence": float(flag.confidence) if flag.confidence else 0.70,
                    "evidence": flag.evidence
                }
                explanation = generate_trilingual_alerts("anomaly", details)
        elif c.source_type == "liquidity":
            forecast = db.query(LiquidityForecast).filter(LiquidityForecast.id == c.source_id).first()
            if forecast:
                source_details = {
                    "risk_level": forecast.risk_level,
                    "eta_minutes": forecast.eta_minutes,
                    "confidence": float(forecast.confidence) if forecast.confidence else 0.80,
                    "reason": forecast.reason
                }
                
                # Fetch latest balance for the explanation
                if c.provider_id is None:
                    pos = db.query(CashPosition).filter(CashPosition.agent_id == c.agent_id).order_by(desc(CashPosition.recorded_at)).first()
                    current_balance = float(pos.amount) if pos else 0.0
                else:
                    bal = db.query(ProviderBalance).filter(ProviderBalance.agent_id == c.agent_id, ProviderBalance.provider_id == c.provider_id).order_by(desc(ProviderBalance.recorded_at)).first()
                    current_balance = float(bal.balance) if bal else 0.0

                details = {
                    "agent_code": agent.agent_code if agent else "Unknown",
                    "provider_name": provider_obj.name if provider_obj else "Shared Cash",
                    "current_balance": current_balance,
                    "eta_minutes": forecast.eta_minutes,
                    "risk_level": forecast.risk_level,
                    "confidence": float(forecast.confidence) if forecast.confidence else 0.80,
                    "reason": forecast.reason
                }
                explanation = generate_trilingual_alerts("liquidity", details)

        results.append({
            "id": c.id,
            "source_type": c.source_type,
            "source_id": c.source_id,
            "agent_id": c.agent_id,
            "agent_code": agent.agent_code if agent else "Unknown",
            "agent_area": agent.area if agent else "Unknown",
            "provider_id": c.provider_id,
            "provider_name": provider_obj.name if provider_obj else "Shared Cash",
            "display_color": provider_obj.display_color if provider_obj else "#4B5563",
            "severity": c.severity,
            "status": c.status,
            "assigned_role": c.assigned_role,
            "assigned_to": c.assigned_to,
            "recommended_action": c.recommended_action,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
            "timeline": events,
            "explanation": explanation,
            "source_details": source_details
        })
    return results

@router.post("/{case_id}/acknowledge")
def post_acknowledge_case(case_id: int, req: AcknowledgeRequest, db: Session = Depends(get_db)):
    case = acknowledge_case(db, case_id, req.actor_role, req.actor_name)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found or status already changed")
    broadcast_event("case_update", {"case_id": case.id, "status": case.status, "assigned_to": case.assigned_to})
    return {"status": "success", "case_status": case.status, "assigned_to": case.assigned_to}

@router.post("/{case_id}/escalate")
def post_escalate_case(case_id: int, req: TransitionRequest, db: Session = Depends(get_db)):
    case = escalate_case(db, case_id, req.actor_role, req.note)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    broadcast_event("case_update", {"case_id": case.id, "status": case.status})
    return {"status": "success", "case_status": case.status}

@router.post("/{case_id}/resolve")
def post_resolve_case(case_id: int, req: TransitionRequest, db: Session = Depends(get_db)):
    case = resolve_case(db, case_id, req.actor_role, req.note)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    broadcast_event("case_update", {"case_id": case.id, "status": case.status})
    return {"status": "success", "case_status": case.status}

@router.post("/{case_id}/notes")
def post_case_note(case_id: int, req: TransitionRequest, db: Session = Depends(get_db)):
    case = add_case_note(db, case_id, req.actor_role, req.note)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    broadcast_event("case_update", {"case_id": case.id, "action": "note_added"})
    return {"status": "success"}

from datetime import datetime

class ReassignRequest(BaseModel):
    actor_role: str
    new_role: str
    note: str

@router.post("/{case_id}/reassign")
def post_reassign_case(case_id: int, req: ReassignRequest, db: Session = Depends(get_db)):
    case = reassign_case(db, case_id, req.actor_role, req.new_role, req.note)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    broadcast_event("case_update", {"case_id": case.id, "assigned_role": case.assigned_role})
    return {"status": "success"}

class ChangeOwnerRequest(BaseModel):
    actor_role: str
    new_owner_name: Optional[str] = None
    new_owner_role: str
    note: str

@router.post("/{case_id}/change-owner")
def post_change_owner(case_id: int, req: ChangeOwnerRequest, db: Session = Depends(get_db)):
    if req.actor_role not in ["management", "admin"]:
        raise HTTPException(status_code=403, detail="Permission denied. Only Management Lead or Admin can change the case owner.")
        
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    old_owner = case.assigned_to
    new_owner = req.new_owner_name if req.new_owner_name else None
    
    case.assigned_to = new_owner
    case.assigned_role = req.new_owner_role
    
    if new_owner is None:
        case.status = 'open'
    else:
        case.status = 'acknowledged'
        
    case.updated_at = datetime.utcnow()
    
    event_note = f"Owner changed from '{old_owner or 'Unassigned'}' to '{new_owner or 'Unassigned'}'. Note: {req.note}"
    db.add(CaseEvent(
        case_id=case.id,
        event_type="reassigned",
        actor_role=req.actor_role,
        note=event_note,
        created_at=datetime.utcnow()
    ))
    db.commit()
    db.refresh(case)
    
    broadcast_event("case_update", {"case_id": case.id, "action": "owner_changed"})
    return {"status": "success", "assigned_to": case.assigned_to, "assigned_role": case.assigned_role}

class ChatMessage(BaseModel):
    message: str
    agent_id: int

@router.post("/chat-diagnose")
def post_chat_diagnose(req: ChatMessage, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == req.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    # 1. Fetch current cash position (Shared Cash pool balance)
    cash_pos = db.query(CashPosition).filter(CashPosition.agent_id == agent.id).order_by(desc(CashPosition.recorded_at)).first()
    shared_cash_amount = float(cash_pos.amount) if cash_pos else 0.0

    # 2. Fetch provider balances
    provider_balances_query = db.query(ProviderBalance).filter(ProviderBalance.agent_id == agent.id).all()
    balances_by_provider = {}
    for pb in provider_balances_query:
        prov = db.query(Provider).filter(Provider.id == pb.provider_id).first()
        pname = prov.name if prov else f"Provider_{pb.provider_id}"
        # Keep the latest recorded balance
        balances_by_provider[pname] = float(pb.balance)

    # 3. Fetch recent anomaly flags
    anomalies_query = db.query(AnomalyFlag).filter(AnomalyFlag.agent_id == agent.id).order_by(desc(AnomalyFlag.created_at)).limit(3).all()
    recent_anomalies = [{
        "pattern_type": a.pattern_type,
        "anomaly_score": float(a.anomaly_score) if a.anomaly_score else 0.0,
        "confidence": float(a.confidence) if a.confidence else 0.0,
        "evidence": a.evidence,
        "created_at": a.created_at.isoformat() if a.created_at else None
    } for a in anomalies_query]

    # 4. Fetch recent liquidity forecasts
    forecasts_query = db.query(LiquidityForecast).filter(LiquidityForecast.agent_id == agent.id).order_by(desc(LiquidityForecast.computed_at)).limit(3).all()
    recent_forecasts = [{
        "provider_id": f.provider_id,
        "risk_level": f.risk_level,
        "eta_minutes": f.eta_minutes,
        "confidence": float(f.confidence) if f.confidence else 0.0,
        "reason": f.reason,
        "computed_at": f.computed_at.isoformat() if f.computed_at else None
    } for f in forecasts_query]

    # Combine into state_context
    state_context = {
        "shared_cash_balance": shared_cash_amount,
        "provider_balances": balances_by_provider,
        "recent_anomalies": recent_anomalies,
        "recent_forecasts": recent_forecasts
    }

    agent_info = {
        "agent_code": agent.agent_code,
        "area": agent.area,
        "thana": agent.thana,
        "district": agent.district
    }

    # Analyze agent message via LLM Advisor
    analysis = analyze_agent_chat_message(req.message, agent_info, state_context)

    needs_support = analysis.get("needs_human_support", False)
    reply = analysis.get("reply", "Thank you for reaching out to Agent Support.")
    
    case_id = None
    status = "closed"
    assigned_role = None

    if needs_support:
        # Determine provider_id based on provider_name returned by LLM
        provider_name = analysis.get("provider_name")
        provider_id = None
        if provider_name:
            prov = db.query(Provider).filter(Provider.name.ilike(provider_name)).first()
            if prov:
                provider_id = prov.id
                
        assigned_role = analysis.get("department") or "field_officer"
        severity = analysis.get("severity") or "review"
        recommendation = analysis.get("recommended_action") or f"Agent Support inquiry: {req.message}"
        scenario = analysis.get("scenario") or "Support requested via chatbot"

        # Determine routing source_type
        if assigned_role == "field_officer":
            source_type = "liquidity"
        elif assigned_role == "risk_analyst":
            source_type = "anomaly"
        elif assigned_role == "provider_ops":
            source_type = "system"
        else:
            source_type = "liquidity" # Default fallback

        new_case = Case(
            source_type=source_type,
            source_id=None,
            agent_id=agent.id,
            provider_id=provider_id,
            severity=severity,
            status="open",
            assigned_role=assigned_role,
            assigned_to=None,
            recommended_action=f"Ops Instructions:\n1. Scenario Context: {scenario}\n2. Action Recommended: {recommendation}"
        )
        db.add(new_case)
        db.commit()
        db.refresh(new_case)
        
        case_id = new_case.id
        status = new_case.status
        
        db.add(CaseEvent(
            case_id=new_case.id,
            event_type="created",
            actor_role="system",
            note=f"Case opened via Agent Support Chatbot. Initial message: '{req.message}'",
            created_at=datetime.utcnow()
        ))
        db.commit()
        
        broadcast_event("case_update", {"case_id": new_case.id, "action": "chat_created"})

    return {
        "reply": reply,
        "case_id": case_id,
        "status": status,
        "assigned_role": assigned_role
    }
