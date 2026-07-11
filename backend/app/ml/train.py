import os
import pickle
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

MODEL_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(MODEL_DIR, "isolation_forest.pkl")

def train_isolation_forest():
    """
    Generates a baseline dataset of normal transactions, trains IsolationForest, and saves the pickle.
    """
    print("Generating baseline dataset of normal transactions for IsolationForest training...")
    np.random.seed(42)
    n_samples = 1500

    # Feature 1: transaction amount (normally distributed around 5000 with standard dev 1500)
    amounts = np.random.normal(loc=5000.0, scale=1500.0, size=n_samples)
    amounts = np.clip(amounts, 500.0, 15000.0) # Normal limits

    # Feature 2: amount deviation from historical mean (which is close to 5000)
    dev_amounts = amounts - 5000.0

    # Feature 3: velocity_10m (normal is 0 to 2 transactions)
    vel_10 = np.random.poisson(lam=0.6, size=n_samples)

    # Feature 4: velocity_30m (normal is 1 to 4 transactions)
    vel_30 = np.random.poisson(lam=1.5, size=n_samples)

    # Feature 5: similar_amounts_30m (normal is 0 to 2 transactions matching range)
    sim_counts = np.random.poisson(lam=0.4, size=n_samples)

    # Feature 6: counterparty_repetition_30m (normal is 0 to 1 repetitions)
    rep_counts = np.random.poisson(lam=0.3, size=n_samples)

    # Feature 7: off_hours_activity (normally active between 9am and 10pm, only 5% occur at off-hours)
    off_hours = np.random.choice([0, 1], size=n_samples, p=[0.95, 0.05])

    # Assemble training dataframe
    X_train = pd.DataFrame({
        "amount": amounts,
        "amount_dev": dev_amounts,
        "velocity_10m": vel_10,
        "velocity_30m": vel_30,
        "similar_amounts_30m": sim_counts,
        "counterparty_repetition_30m": rep_counts,
        "off_hours": off_hours
    })

    print(f"X_train shape: {X_train.shape}")
    print("Training IsolationForest model...")
    # Train IsolationForest model
    model = IsolationForest(
        n_estimators=150,
        contamination=0.03, # 3% anomalies expected in normal data fluctuations
        random_state=42
    )
    model.fit(X_train)

    # Save pickle
    os.makedirs(MODEL_DIR, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    
    print(f"IsolationForest model trained and saved successfully to: {MODEL_PATH}")

if __name__ == "__main__":
    train_isolation_forest()
