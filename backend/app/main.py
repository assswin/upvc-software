import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import customers, dashboard, measurements, passcode, projects, settings
from app.db.init_db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


class StripApiPrefixMiddleware:
    """Strip /api prefix when routed through Vercel Services rewrites."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") in ("http", "websocket"):
            path = scope.get("path", "")
            if path == "/api":
                scope = dict(scope, path="/")
            elif path.startswith("/api/"):
                scope = dict(scope, path=path[4:])
        await self.app(scope, receive, send)


app = FastAPI(
    title="LS Interiors API",
    description="Window Measurement and Project Management System",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(StripApiPrefixMiddleware)

raw_origins = os.getenv("CORS_ORIGINS")
allowed_origins = (
    [o.strip() for o in raw_origins.split(",") if o.strip()]
    if raw_origins
    else ["http://localhost:5173", "http://127.0.0.1:5173"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(passcode.router)
app.include_router(customers.router)
app.include_router(projects.router)
app.include_router(measurements.router)
app.include_router(dashboard.router)
app.include_router(settings.router)


@app.get("/")
def home():
    return {
        "message": "Welcome to LS Interiors API",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "application": "LS Interiors",
    }
