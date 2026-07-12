from datetime import datetime
from sqlalchemy.orm import Session
from backend.app.models.schemas import Case, CaseEvent

def create_case_from_alert(db: Session, source_type: str, source_id: int, agent_id: int, provider_id: int = None, severity: str = "review", recommended_action: str = ""):
    """
    Creates a new case from a liquidity forecast or anomaly alert and routes it.
    """
    # Routing logic
    if source_type == 'liquidity':
        assigned_role = 'field_officer'
    elif source_type == 'anomaly':
        assigned_role = 'risk_analyst'
    elif source_type == 'system':
        assigned_role = 'provider_ops'
    else:
        assigned_role = 'field_officer' # Fallback

    new_case = Case(
        source_type=source_type,
        source_id=source_id,
        agent_id=agent_id,
        provider_id=provider_id,
        severity=severity,
        status='open',
        assigned_role=assigned_role,
        assigned_to=None,
        recommended_action=recommended_action,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(new_case)
    db.commit()
    db.refresh(new_case)

    # Log timeline event
    log_case_event(
        db=db,
        case_id=new_case.id,
        event_type='created',
        actor_role='system',
        note=f"Alert generated: Routed to {assigned_role}."
    )

    return new_case

def acknowledge_case(db: Session, case_id: int, actor_role: str, actor_name: str):
    """
    Acknowledges a case, transitioning status: open -> acknowledged.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        return None
    
    if case.status == 'open':
        case.status = 'acknowledged'
        case.assigned_to = actor_name
        case.updated_at = datetime.utcnow()
        db.commit()
        
        log_case_event(
            db=db,
            case_id=case_id,
            event_type='acknowledged',
            actor_role=actor_role,
            note=f"Case acknowledged by {actor_name} ({actor_role})."
        )
    return case

def escalate_case(db: Session, case_id: int, actor_role: str, note: str):
    """
    Escalates a case, transitioning status: open/acknowledged -> escalated.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        return None
    
    case.status = 'escalated'
    case.updated_at = datetime.utcnow()
    db.commit()

    log_case_event(
        db=db,
        case_id=case_id,
        event_type='escalated',
        actor_role=actor_role,
        note=note
    )
    return case

def resolve_case(db: Session, case_id: int, actor_role: str, note: str):
    """
    Resolves a case, transitioning status: open/acknowledged/escalated -> resolved.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        return None
    
    case.status = 'resolved'
    case.updated_at = datetime.utcnow()
    db.commit()

    log_case_event(
        db=db,
        case_id=case_id,
        event_type='resolved',
        actor_role=actor_role,
        note=note
    )
    return case

def add_case_note(db: Session, case_id: int, actor_role: str, note: str):
    """
    Adds a custom timeline note to a case without changing its status.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        return None
    
    log_case_event(
        db=db,
        case_id=case_id,
        event_type='note',
        actor_role=actor_role,
        note=note
    )
    return case

def log_case_event(db: Session, case_id: int, event_type: str, actor_role: str, note: str):
    """
    Writes a timeline event to the case_events audit log.
    """
    event = CaseEvent(
        case_id=case_id,
        event_type=event_type,
        actor_role=actor_role,
        note=note,
        created_at=datetime.utcnow()
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event

def reassign_case(db: Session, case_id: int, actor_role: str, new_role: str, note: str):
    """
    Reassigns the case to another department (role) and logs a timeline event.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        return None
    
    old_role = case.assigned_role
    case.assigned_role = new_role
    case.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(case)
    
    log_case_event(
        db=db,
        case_id=case_id,
        event_type='reassigned',
        actor_role=actor_role,
        note=f"Reassigned from {old_role} to {new_role}. Note: {note}"
    )
    return case
