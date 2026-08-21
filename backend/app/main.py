import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Body, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import ai, market, store
from .config import COLLECTIONS, settings

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("sds")


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        store.ensure_indices()
        log.info("OpenSearch indices ready at %s", settings.opensearch_host)
    except Exception as exc:  # noqa: BLE001 - keep the API up so /health can report
        log.error("Failed to prepare OpenSearch indices: %s", exc)
    yield


app = FastAPI(title="Stock Decision System API", version="0.83", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, Any]:
    try:
        info = store.client.info()
        opensearch = {"ok": True, "version": info["version"]["number"]}
    except Exception as exc:  # noqa: BLE001
        opensearch = {"ok": False, "error": str(exc)}
    return {
        "ok": opensearch["ok"],
        "opensearch": opensearch,
        "aiConfigured": bool(settings.gemini_api_key),
        "collections": COLLECTIONS,
    }


# --- Document store (replaces Firestore) -------------------------------------


@app.get("/api/collections/{collection}")
def list_documents(collection: str) -> list[dict[str, Any]]:
    try:
        return store.list_docs(collection)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/collections/{collection}/{doc_id}")
def get_document(collection: str, doc_id: str) -> dict[str, Any]:
    try:
        data = store.get_doc(collection, doc_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"exists": data is not None, "data": data}


@app.put("/api/collections/{collection}/{doc_id}")
def put_document(
    collection: str,
    doc_id: str,
    data: dict[str, Any] = Body(...),
    merge: bool = Query(False),
) -> dict[str, Any]:
    try:
        return store.set_doc(collection, doc_id, data, merge)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete("/api/collections/{collection}/{doc_id}")
def delete_document(collection: str, doc_id: str) -> dict[str, Any]:
    try:
        return {"deleted": store.delete_doc(collection, doc_id)}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


class BatchOperation(BaseModel):
    op: str = "set"
    collection: str
    id: str
    data: dict[str, Any] | None = None
    merge: bool = False


@app.post("/api/batch")
def commit_batch(operations: list[BatchOperation]) -> dict[str, Any]:
    try:
        applied = store.commit_batch([o.model_dump() for o in operations])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"applied": applied}


# --- Market data -------------------------------------------------------------


def _clean_symbol(symbol: str) -> str:
    """Tickers stored with stray whitespace would otherwise never resolve."""
    return symbol.strip().upper()


@app.get("/api/market/history")
async def market_history(symbol: str, avKey: str = "") -> dict[str, Any]:
    symbol = _clean_symbol(symbol)
    return {"symbol": symbol, "history": await market.fetch_history(symbol, avKey)}


@app.get("/api/market/quote")
async def market_quote(symbol: str) -> dict[str, Any]:
    symbol = _clean_symbol(symbol)
    return {"symbol": symbol, "quote": await market.fetch_quote(symbol)}


@app.get("/api/market/search")
async def market_search(q: str) -> dict[str, Any]:
    return {"results": await market.search_symbols(q)}


# --- AI ----------------------------------------------------------------------


class GenerateRequest(BaseModel):
    prompt: str


class ChatRequest(BaseModel):
    messages: list[dict[str, Any]]
    context: str = ""
    lang: str = "zh"


@app.post("/api/ai/generate")
async def ai_generate(req: GenerateRequest) -> dict[str, Any]:
    try:
        return {"text": await ai.generate(req.prompt)}
    except ai.AiNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/ai/chat")
async def ai_chat(req: ChatRequest) -> dict[str, Any]:
    try:
        return {"text": await ai.chat(req.messages, req.context, req.lang)}
    except ai.AiNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
