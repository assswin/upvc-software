import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))
sys.path.insert(0, str(ROOT_DIR / "backend"))

from app.main import app as fastapi_app  # noqa: E402


class StripApiPrefixMiddleware:
    """Strip /api prefix when routed through Vercel rewrites."""

    def __init__(self, asgi_app):
        self.asgi_app = asgi_app

    async def __call__(self, scope, receive, send):
        if scope.get("type") in ("http", "websocket"):
            path = scope.get("path", "")
            if path == "/api":
                scope = dict(scope, path="/")
            elif path.startswith("/api/"):
                scope = dict(scope, path=path[4:])
        await self.asgi_app(scope, receive, send)


app = StripApiPrefixMiddleware(fastapi_app)
handler = app
