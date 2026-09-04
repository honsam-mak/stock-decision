import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Body, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import ai, market, store
from .auth import AuthUser, require_owner
from .config import COLLECTIONS, settings

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("sds")


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        store.ensure_indices()
        log.info("%s document store ready", settings.store_backend)
    except Exception as exc:  # noqa: BLE001 - keep the API up so /health can report
        log.error("Failed to prepare document store: %s", exc)
    yield


app = FastAPI(title="Stock Decision System API", version="0.83", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, Any]:
    storage = store.health()
    return {
        "ok": storage["ok"],
        "storage": storage,
        "aiConfigured": bool(settings.gemini_api_key),
        "collections": COLLECTIONS,
    }


# --- Document store (replaces Firestore) -------------------------------------


@app.get("/api/collections/{collection}")
def list_documents(
    collection: str, user: AuthUser = Depends(require_owner)
) -> list[dict[str, Any]]:
    try:
        return store.list_docs(collection, user.id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/collections/{collection}/{doc_id}")
def get_document(
    collection: str,
    doc_id: str,
    user: AuthUser = Depends(require_owner),
) -> dict[str, Any]:
    try:
        data = store.get_doc(collection, doc_id, user.id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"exists": data is not None, "data": data}


@app.put("/api/collections/{collection}/{doc_id}")
def put_document(
    collection: str,
    doc_id: str,
    data: dict[str, Any] = Body(...),
    merge: bool = Query(False),
    user: AuthUser = Depends(require_owner),
) -> dict[str, Any]:
    try:
        return store.set_doc(collection, doc_id, data, merge, user.id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete("/api/collections/{collection}/{doc_id}")
def delete_document(
    collection: str,
    doc_id: str,
    user: AuthUser = Depends(require_owner),
) -> dict[str, Any]:
    try:
        return {"deleted": store.delete_doc(collection, doc_id, user.id)}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


class BatchOperation(BaseModel):
    op: str = "set"
    collection: str
    id: str
    data: dict[str, Any] | None = None
    merge: bool = False


@app.post("/api/batch")
def commit_batch(
    operations: list[BatchOperation],
    user: AuthUser = Depends(require_owner),
) -> dict[str, Any]:
    try:
        applied = store.commit_batch(
            [operation.model_dump() for operation in operations], user.id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"applied": applied}


# --- Market data -------------------------------------------------------------


def _clean_symbol(symbol: str) -> str:
    """Tickers stored with stray whitespace would otherwise never resolve."""
    return symbol.strip().upper()


@app.get("/api/market/history")
async def market_history(
    symbol: str,
    avKey: str = "",
    _: AuthUser = Depends(require_owner),
) -> dict[str, Any]:
    symbol = _clean_symbol(symbol)
    return {"symbol": symbol, "history": await market.fetch_history(symbol, avKey)}


@app.get("/api/market/quote")
async def market_quote(
    symbol: str, _: AuthUser = Depends(require_owner)
) -> dict[str, Any]:
    symbol = _clean_symbol(symbol)
    return {"symbol": symbol, "quote": await market.fetch_quote(symbol)}


@app.get("/api/market/search")
async def market_search(
    q: str, _: AuthUser = Depends(require_owner)
) -> dict[str, Any]:
    return {"results": await market.search_symbols(q)}


# --- AI ----------------------------------------------------------------------


class GenerateRequest(BaseModel):
    prompt: str


class ChatRequest(BaseModel):
    messages: list[dict[str, Any]]
    context: str = ""
    lang: str = "zh"


@app.post("/api/ai/generate")
async def ai_generate(
    req: GenerateRequest, _: AuthUser = Depends(require_owner)
) -> dict[str, Any]:
    try:
        return {"text": await ai.generate(req.prompt)}
    except ai.AiNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/ai/chat")
async def ai_chat(
    req: ChatRequest, _: AuthUser = Depends(require_owner)
) -> dict[str, Any]:
    try:
        return {"text": await ai.chat(req.messages, req.context, req.lang)}
    except ai.AiNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
