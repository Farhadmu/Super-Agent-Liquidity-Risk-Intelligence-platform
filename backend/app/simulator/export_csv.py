import os
import sys
import pandas as pd

sys.path.append("/Applications/XAMPP/xamppfiles/htdocs/sust hackathon")

from backend.app.models.database import engine

EXPORT_DIR = "/Applications/XAMPP/xamppfiles/htdocs/sust hackathon/data/synthetic"

def export_tables_to_csv():
    print("Exporting database tables to CSV...")
    os.makedirs(EXPORT_DIR, exist_ok=True)
    
    tables = [
        "providers",
        "agents",
        "cash_positions",
        "provider_balances",
        "transactions",
        "liquidity_forecasts",
        "anomaly_flags",
        "cases",
        "case_events"
    ]
    
    for table in tables:
        try:
            df = pd.read_sql_table(table, con=engine)
            file_path = os.path.join(EXPORT_DIR, f"{table}.csv")
            df.to_csv(file_path, index=False)
            print(f"Exported table '{table}' ({len(df)} rows) to: {file_path}")
        except Exception as e:
            print(f"Failed to export table '{table}': {e}")

if __name__ == "__main__":
    export_tables_to_csv()
