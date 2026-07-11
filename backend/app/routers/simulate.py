from fastapi import APIRouter, BackgroundTasks
from backend.app.simulator.generate_data import seed_database

router = APIRouter(prefix="/simulate", tags=["simulate"])

@router.post("/seed")
def trigger_seed(background_tasks: BackgroundTasks):
    # Run database seeding in background to prevent request timeout
    background_tasks.add_task(seed_database)
    return {"status": "success", "message": "Database seeding triggered. Re-building schemas, training IsolationForest, and regenerating scenarios."}
