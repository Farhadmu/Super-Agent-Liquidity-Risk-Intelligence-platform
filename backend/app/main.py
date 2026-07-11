import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.models.database import engine, Base
from backend.app.routers import agents, cases, simulate, metrics, stream

# Initialize all database tables on startup
Base.metadata.create_all(bind=engine)

from backend.app.models.schemas import Agent
from backend.app.simulator.generate_data import seed_database
from backend.app.models.database import SessionLocal

db = SessionLocal()
try:
    if db.query(Agent).count() == 0:
        print("Database is empty. Auto-seeding baseline data...")
        seed_database()
finally:
    db.close()

app = FastAPI(
    title="Multi-Provider Super Agent Backend",
    description="FastAPI gateway managing liquidity forecasts, transaction anomaly detection, and operational coordination cases.",
    version="1.0.0"
)

# Configure CORS for local React frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for the hackathon prototype
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(agents.router)
app.include_router(cases.router)
app.include_router(simulate.router)
app.include_router(metrics.router)
app.include_router(stream.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Multi-Provider Super Agent API gateway. Use /docs to view the Swagger schema."}

if __name__ == "__main__":
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8080, reload=True)
