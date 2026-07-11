from datetime import datetime
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from backend.app.models.database import Base

class Provider(Base):
    __tablename__ = 'providers'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    display_color = Column(String(20))

    balances = relationship("ProviderBalance", back_populates="provider")
    transactions = relationship("Transaction", back_populates="provider")

class Agent(Base):
    __tablename__ = 'agents'

    id = Column(Integer, primary_key=True, index=True)
    agent_code = Column(String(20), unique=True, nullable=False)
    area = Column(String(100))
    thana = Column(String(100))
    district = Column(String(100))

    cash_positions = relationship("CashPosition", back_populates="agent")
    provider_balances = relationship("ProviderBalance", back_populates="agent")
    transactions = relationship("Transaction", back_populates="agent")
    forecasts = relationship("LiquidityForecast", back_populates="agent")
    anomalies = relationship("AnomalyFlag", back_populates="agent")
    cases = relationship("Case", back_populates="agent")

class CashPosition(Base):
    __tablename__ = 'cash_positions'

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey('agents.id'), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    recorded_at = Column(DateTime, default=datetime.utcnow)

    agent = relationship("Agent", back_populates="cash_positions")

class ProviderBalance(Base):
    __tablename__ = 'provider_balances'

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey('agents.id'), nullable=False)
    provider_id = Column(Integer, ForeignKey('providers.id'), nullable=False)
    balance = Column(Numeric(14, 2), nullable=False)
    recorded_at = Column(DateTime, default=datetime.utcnow)

    agent = relationship("Agent", back_populates="provider_balances")
    provider = relationship("Provider", back_populates="balances")

class Transaction(Base):
    __tablename__ = 'transactions'

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey('agents.id'), nullable=False)
    provider_id = Column(Integer, ForeignKey('providers.id'), nullable=False)
    tx_type = Column(String(20)) # cash_in, cash_out, transfer
    amount = Column(Numeric(14, 2), nullable=False)
    counterparty_ref = Column(String(64))
    status = Column(String(20))
    created_at = Column(DateTime, default=datetime.utcnow)

    agent = relationship("Agent", back_populates="transactions")
    provider = relationship("Provider", back_populates="transactions")

class LiquidityForecast(Base):
    __tablename__ = 'liquidity_forecasts'

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey('agents.id'), nullable=False)
    provider_id = Column(Integer, nullable=True) # NULL = shared cash pool
    risk_level = Column(String(20)) # low, medium, high
    eta_minutes = Column(Integer, nullable=True)
    confidence = Column(Numeric(4, 2))
    reason = Column(Text)
    computed_at = Column(DateTime, default=datetime.utcnow)

    agent = relationship("Agent", back_populates="forecasts")

class AnomalyFlag(Base):
    __tablename__ = 'anomaly_flags'

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey('agents.id'), nullable=False)
    provider_id = Column(Integer, ForeignKey('providers.id'), nullable=False)
    pattern_type = Column(String(50)) # velocity_spike, near_identical_amounts, repeated_counterparty, off_hours_activity
    anomaly_score = Column(Numeric(5, 4))
    evidence = Column(JSON)
    confidence = Column(Numeric(4, 2))
    created_at = Column(DateTime, default=datetime.utcnow)

    agent = relationship("Agent", back_populates="anomalies")

class Case(Base):
    __tablename__ = 'cases'

    id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String(20)) # liquidity, anomaly
    source_id = Column(Integer) # FK to liquidity_forecasts.id or anomaly_flags.id
    agent_id = Column(Integer, ForeignKey('agents.id'), nullable=False)
    provider_id = Column(Integer, nullable=True)
    severity = Column(String(20)) # info, review, urgent
    status = Column(String(20), default='open') # open, acknowledged, escalated, resolved
    assigned_role = Column(String(50)) # field_officer, provider_ops, risk_analyst
    assigned_to = Column(String(50), nullable=True)
    recommended_action = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    agent = relationship("Agent", back_populates="cases")
    events = relationship("CaseEvent", back_populates="case", cascade="all, delete-orphan")

class CaseEvent(Base):
    __tablename__ = 'case_events'

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey('cases.id'), nullable=False)
    event_type = Column(String(30)) # created, acknowledged, escalated, note, resolved
    actor_role = Column(String(50))
    note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="events")
