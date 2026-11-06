import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# 1. Load api/.env BEFORE importing the graph: the chat models read
#    OPENAI_API_KEY when their modules are imported. override=True makes the
#    file win over a stale value already in the environment.
load_dotenv(Path(__file__).parent / ".env", override=True)

# 2. The graph code lives in src/ and uses top-level imports
#    (`from state import ...`), so put src/ on the import path.
sys.path.insert(0, str(Path(__file__).parent / "src"))

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from routes.sessions import router as sessions_router  # noqa: E402

app = FastAPI(title="Diagnostic Medical API")

# 3. CORS: the React dev server (localhost:5173) is a different origin than this
#    API (localhost:8000), so the browser needs explicit permission to call it.
#    Comma-separated list, e.g. FRONTEND_ORIGIN=http://localhost:5173,https://my.app
allowed_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(sessions_router)


@app.get("/api/health")
def health():
    return {"Health": "OK!"}
