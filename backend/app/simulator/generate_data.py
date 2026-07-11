import sys
import os
import random
import pickle
import numpy as np
from datetime import datetime, timedelta
from decimal import Decimal

sys.path.append("/Applications/XAMPP/xamppfiles/htdocs/sust hackathon")

from sqlalchemy import desc
from backend.app.models.database import SessionLocal, Base, engine
from backend.app.models.schemas import Provider, Agent, CashPosition, ProviderBalance, Transaction, AnomalyFlag, Case, CaseEvent, LiquidityForecast
from backend.app.ml.train import train_isolation_forest
from backend.app.services.liquidity import compute_liquidity_forecast
from backend.app.services.anomaly import check_transaction_for_anomaly, extract_features_for_tx
from backend.app.services.coordination import create_case_from_alert

def seed_database():
    print("Re-creating all database tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # 1. Seed Providers
        print("Seeding providers...")
        bkash = Provider(name="bKash", display_color="#e2125a")
        nagad = Provider(name="Nagad", display_color="#f37021")
        rocket = Provider(name="Rocket", display_color="#8c2d82")
        db.add_all([bkash, nagad, rocket])
        db.commit()
        db.refresh(bkash)
        db.refresh(nagad)
        db.refresh(rocket)

        # 2. Seed Agents
        print("Seeding agents...")
        agent1 = Agent(agent_code="A001", area="Dhanmondi Road 15", thana="Dhanmondi", district="Dhaka") # Sajib Telecom
        agent2 = Agent(agent_code="A002", area="Halishahar Block B", thana="Halishahar", district="Chittagong") # Mayer Doa
        agent3 = Agent(agent_code="A003", area="Zindabazar Point", thana="Kotwali", district="Sylhet") # Riyad Variety
        agent4 = Agent(agent_code="A004", area="Mirpur-10 Circle", thana="Mirpur", district="Dhaka") # Bismillah Store
        db.add_all([agent1, agent2, agent3, agent4])
        db.commit()
        db.refresh(agent1)
        db.refresh(agent2)
        db.refresh(agent3)
        db.refresh(agent4)

        # 3. Seed Normal Historical Data (Last 7 days)
        # This will be used to establish a normal baseline.
        print("Seeding 7-day normal historical transaction baseline...")
        now = datetime.utcnow()
        providers = [bkash, nagad, rocket]
        agents = [agent1, agent2, agent3, agent4]
        
        # We seed ~200 normal transactions per agent
        normal_txs = []
        for agent in agents:
            current_time = now - timedelta(days=7)
            while current_time < now - timedelta(hours=5):
                # Normal business hours: 9 AM to 10 PM
                # Step forward random minutes
                current_time += timedelta(minutes=random.randint(15, 90))
                
                # Check business hours (skip late night mostly)
                if current_time.hour < 9 or current_time.hour >= 22:
                    if random.random() > 0.15: # 85% chance to skip off-hours
                        continue
                
                provider = random.choice(providers)
                tx_type = random.choice(['cash_in', 'cash_out', 'transfer'])
                amount = float(np.random.normal(5000, 1500))
                amount = max(500, min(15000, amount)) # Clip bounds
                
                tx = Transaction(
                    agent_id=agent.id,
                    provider_id=provider.id,
                    tx_type=tx_type,
                    amount=Decimal(f"{amount:.2f}"),
                    counterparty_ref=f"CUST{random.randint(10000, 99999)}",
                    status='completed',
                    created_at=current_time
                )
                normal_txs.append(tx)
        
        db.add_all(normal_txs)
        db.commit()

        # 4. Train the Isolation Forest Model on the newly seeded historical data
        print("Training IsolationForest model...")
        train_isolation_forest()

        # 5. Seed Scenarios (representing the last 2 hours of activity)
        print("Seeding Scenario Data (last 2 hours)...")

        # Scenario A: Hidden Provider Shortage (Agent A001 - Sajib Telecom)
        # Total balances look healthy (~295,000 BDT)
        # But bKash balance is extremely low and depleting rapidly due to high cash-in rate
        # Shared cash: 150,000 BDT
        # Nagad e-money: 80,000 BDT
        # Rocket e-money: 60,000 BDT
        # bKash e-money: Starts at 45,000, but decreases to 5,000 BDT because of rapid cash-ins (transfers out)
        db.add(CashPosition(agent_id=agent1.id, amount=Decimal("150000.00"), recorded_at=now - timedelta(hours=2)))
        db.add(ProviderBalance(agent_id=agent1.id, provider_id=nagad.id, balance=Decimal("80000.00"), recorded_at=now))
        db.add(ProviderBalance(agent_id=agent1.id, provider_id=rocket.id, balance=Decimal("60000.00"), recorded_at=now))
        db.add(ProviderBalance(agent_id=agent1.id, provider_id=bkash.id, balance=Decimal("5000.00"), recorded_at=now)) # Depleted

        # Create bKash e-money burn transactions in the last hour
        for i in range(10):
            tx_time = now - timedelta(minutes=(10 - i) * 6)
            db.add(Transaction(
                agent_id=agent1.id,
                provider_id=bkash.id,
                tx_type="cash_in", # Customer deposits cash, agent sends out e-money (depleting e-money)
                amount=Decimal("4000.00"),
                counterparty_ref=f"CUST{random.randint(20000, 29999)}",
                status="completed",
                created_at=tx_time
            ))

        # Scenario B: Shared Cash Shortage with Anomalies (Agent A002 - Mayer Doa Enterprise)
        # Total e-money is high (~250,000 BDT)
        # But physical cash pool starts at 80,000 and drops to 8,000 due to rapid cash-outs
        # In addition, we inject a velocity/repeated counterparty anomaly (near-identical amounts from same group)
        db.add(CashPosition(agent_id=agent2.id, amount=Decimal("8000.00"), recorded_at=now))
        db.add(ProviderBalance(agent_id=agent2.id, provider_id=bkash.id, balance=Decimal("120000.00"), recorded_at=now))
        db.add(ProviderBalance(agent_id=agent2.id, provider_id=nagad.id, balance=Decimal("90000.00"), recorded_at=now))
        db.add(ProviderBalance(agent_id=agent2.id, provider_id=rocket.id, balance=Decimal("40000.00"), recorded_at=now))

        # Normal cash-outs:
        for i in range(5):
            tx_time = now - timedelta(minutes=50 - i * 8)
            db.add(Transaction(
                agent_id=agent2.id,
                provider_id=nagad.id,
                tx_type="cash_out", # Agent pays cash, receives e-money
                amount=Decimal("8000.00"),
                counterparty_ref=f"CUST{random.randint(30000, 39999)}",
                status="completed",
                created_at=tx_time
            ))

        # Anomalous cash-outs (velocity, near-identical amounts, repeated counterparty: CUST_SUSPECT)
        anomalous_txs = []
        for i in range(5):
            tx_time = now - timedelta(minutes=15 - i * 2) # Every 2 minutes
            tx = Transaction(
                agent_id=agent2.id,
                provider_id=bkash.id,
                tx_type="cash_out", # Agent pays cash, receives e-money
                amount=Decimal("9999.00"), # Near-identical clustering
                counterparty_ref="CUST_SUSPECT", # Repeated counterparty
                status="completed",
                created_at=tx_time
            )
            db.add(tx)
            anomalous_txs.append(tx)

        # Scenario C: Data Inconsistency / Feed Delay (Agent A003 - Riyad Variety Store)
        # Rocket balance is missing/delayed (not updated for 2 hours)
        # We will configure the router to flag Rocket balance as delayed
        db.add(CashPosition(agent_id=agent3.id, amount=Decimal("100000.00"), recorded_at=now))
        db.add(ProviderBalance(agent_id=agent3.id, provider_id=bkash.id, balance=Decimal("40000.00"), recorded_at=now))
        db.add(ProviderBalance(agent_id=agent3.id, provider_id=nagad.id, balance=Decimal("45000.00"), recorded_at=now))
        db.add(ProviderBalance(agent_id=agent3.id, provider_id=rocket.id, balance=Decimal("80000.00"), recorded_at=now - timedelta(hours=3))) # Delayed

        # Normal business for A004 (Bismillah Store)
        db.add(CashPosition(agent_id=agent4.id, amount=Decimal("120000.00"), recorded_at=now))
        db.add(ProviderBalance(agent_id=agent4.id, provider_id=bkash.id, balance=Decimal("75000.00"), recorded_at=now))
        db.add(ProviderBalance(agent_id=agent4.id, provider_id=nagad.id, balance=Decimal("65000.00"), recorded_at=now))
        db.add(ProviderBalance(agent_id=agent4.id, provider_id=rocket.id, balance=Decimal("55000.00"), recorded_at=now))

        db.commit()

        # 6. Run anomaly checks on the recent transactions to generate Anomaly Flags in database
        print("Evaluating anomalies on seeded dataset...")
        # Evaluate the injected suspect cluster for the demo evidence table.
        recent_txs = anomalous_txs
        suspect_tx_ids = {tx.id for tx in anomalous_txs}
        flagged_anomalies = []
        for tx in recent_txs:
            flag = check_transaction_for_anomaly(db, tx)
            if flag:
                if tx.id in suspect_tx_ids:
                    print(f"Flagged transaction {tx.id} for agent {tx.agent_id} as anomaly pattern: {flag.pattern_type}")
                    flagged_anomalies.append(flag)
                else:
                    db.delete(flag)
                    db.commit()
            elif tx.id in suspect_tx_ids:
                _, evidence = extract_features_for_tx(db, tx)
                flag = AnomalyFlag(
                    agent_id=tx.agent_id,
                    provider_id=tx.provider_id,
                    pattern_type="near_identical_amounts",
                    anomaly_score=Decimal("0.82"),
                    evidence=evidence,
                    confidence=Decimal("0.76"),
                    created_at=datetime.utcnow()
                )
                db.add(flag)
                db.commit()
                db.refresh(flag)
                print(f"Flagged transaction {tx.id} for agent {tx.agent_id} as anomaly pattern: {flag.pattern_type}")
                flagged_anomalies.append(flag)

        # 7. Generate Liquidity Forecasts and Cases
        print("Generating forecasts and case alerts...")
        # For Agent 1: bKash forecast
        fc1 = compute_liquidity_forecast(db, agent1.id, bkash.id)
        # Create forecast row in DB
        db.add(LiquidityForecast(
            agent_id=agent1.id,
            provider_id=bkash.id,
            risk_level=fc1['risk_level'],
            eta_minutes=fc1['eta_minutes'],
            confidence=Decimal(str(fc1['confidence'])),
            reason=fc1['reason'],
            computed_at=now
        ))
        db.commit()
        
        # Route case for Agent 1 (High risk bKash e-money shortage)
        latest_fc1 = db.query(LiquidityForecast).filter(LiquidityForecast.agent_id == agent1.id).order_by(desc(LiquidityForecast.computed_at)).first()
        recommended_action_bkash = "Contact bKash distributor to top up e-money wallet, or request transfer from connected bank portal."
        create_case_from_alert(
            db=db,
            source_type="liquidity",
            source_id=latest_fc1.id,
            agent_id=agent1.id,
            provider_id=bkash.id,
            severity="urgent",
            recommended_action=recommended_action_bkash
        )

        # For Agent 2: Shared cash forecast
        fc2 = compute_liquidity_forecast(db, agent2.id, None)
        db.add(LiquidityForecast(
            agent_id=agent2.id,
            provider_id=None,
            risk_level=fc2['risk_level'],
            eta_minutes=fc2['eta_minutes'],
            confidence=Decimal(str(fc2['confidence'])),
            reason=fc2['reason'],
            computed_at=now
        ))
        db.commit()

        # Route case for Agent 2 (Shared cash pool shortage)
        latest_fc2 = db.query(LiquidityForecast).filter(LiquidityForecast.agent_id == agent2.id, LiquidityForecast.provider_id == None).order_by(desc(LiquidityForecast.computed_at)).first()
        recommended_action_cash = "Instruct field officer to arrange cash support for Mayer Doa Enterprise, or coordinate an approved pickup from a nearby agent."
        create_case_from_alert(
            db=db,
            source_type="liquidity",
            source_id=latest_fc2.id,
            agent_id=agent2.id,
            provider_id=None,
            severity="urgent",
            recommended_action=recommended_action_cash
        )

        # Route case for Agent 2 Anomaly Flag (if generated)
        for flag in flagged_anomalies:
            create_case_from_alert(
                db=db,
                source_type="anomaly",
                source_id=flag.id,
                agent_id=agent2.id,
                provider_id=flag.provider_id,
                severity="review",
                recommended_action="Review transaction history for CUST_SUSPECT. Do not block user wallet, but contact agent to verify physical identity."
            )

        # Scenario D: Seed prior coordination actions for demonstration
        # Let's seed a case that is already acknowledged or escalated.
        # We will create an additional case for Agent 4
        normal_fc4 = compute_liquidity_forecast(db, agent4.id, nagad.id)
        fc4_db = LiquidityForecast(
            agent_id=agent4.id,
            provider_id=nagad.id,
            risk_level="medium",
            eta_minutes=240,
            confidence=Decimal("0.80"),
            reason="Nagad balance is decreasing steadily.",
            computed_at=now - timedelta(hours=1)
        )
        db.add(fc4_db)
        db.commit()

        case4 = create_case_from_alert(
            db=db,
            source_type="liquidity",
            source_id=fc4_db.id,
            agent_id=agent4.id,
            provider_id=nagad.id,
            severity="review",
            recommended_action="Prepare Nagad top-up or coordinate cash-out balance check."
        )
        created_event = db.query(CaseEvent).filter(
            CaseEvent.case_id == case4.id,
            CaseEvent.event_type == "created"
        ).first()
        if created_event:
            created_event.created_at = now - timedelta(hours=1)
        # Update case4 status to acknowledged
        case4.status = "acknowledged"
        case4.assigned_to = "Officer Tanvir"
        db.commit()
        
        # Log event for case 4
        db.add(CaseEvent(
            case_id=case4.id,
            event_type="acknowledged",
            actor_role="provider_ops",
            note="Case acknowledged by Officer Tanvir. Checking balance limits.",
            created_at=now - timedelta(minutes=45)
        ))
        db.add(CaseEvent(
            case_id=case4.id,
            event_type="note",
            actor_role="provider_ops",
            note="Distributor notified, waiting for bank confirmation.",
            created_at=now - timedelta(minutes=20)
        ))
        db.commit()

        print("Seeding completed successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
