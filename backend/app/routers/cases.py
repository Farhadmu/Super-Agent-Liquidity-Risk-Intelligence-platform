from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from typing import List, Optional
from backend.app.models.database import get_db
from backend.app.models.schemas import Case, Agent, Provider, CaseEvent
from backend.app.services.coordination import acknowledge_case, escalate_case, resolve_case, add_case_note

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
            "timeline": events
        })
    return results

@router.post("/{case_id}/acknowledge")
def post_acknowledge_case(case_id: int, req: AcknowledgeRequest, db: Session = Depends(get_db)):
    case = acknowledge_case(db, case_id, req.actor_role, req.actor_name)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found or status already changed")
    return {"status": "success", "case_status": case.status, "assigned_to": case.assigned_to}

@router.post("/{case_id}/escalate")
def post_escalate_case(case_id: int, req: TransitionRequest, db: Session = Depends(get_db)):
    case = escalate_case(db, case_id, req.actor_role, req.note)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"status": "success", "case_status": case.status}

@router.post("/{case_id}/resolve")
def post_resolve_case(case_id: int, req: TransitionRequest, db: Session = Depends(get_db)):
    case = resolve_case(db, case_id, req.actor_role, req.note)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"status": "success", "case_status": case.status}

@router.post("/{case_id}/notes")
def post_case_note(case_id: int, req: TransitionRequest, db: Session = Depends(get_db)):
    case = add_case_note(db, case_id, req.actor_role, req.note)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"status": "success"}
