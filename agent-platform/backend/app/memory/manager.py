from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Optional
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct, Filter,
    FieldCondition, MatchValue, ScoredPoint,
)
from ..config import settings

COLLECTION = "agent_memories"
VECTOR_SIZE = 384  # BAAI/bge-small-en-v1.5 via fastembed


class MemoryManager:
    """Vector-backed episodic memory per agent using Qdrant + fastembed."""

    def __init__(self):
        self._client: Optional[AsyncQdrantClient] = None
        self._embedder = None  # cached fastembed model (loading it is expensive)

    async def _get_client(self) -> AsyncQdrantClient:
        if self._client is None:
            self._client = AsyncQdrantClient(
                host=settings.qdrant_host,
                port=settings.qdrant_port,
                prefer_grpc=False,
            )
            # Ensure collection exists
            collections = await self._client.get_collections()
            names = [c.name for c in collections.collections]
            if COLLECTION not in names:
                await self._client.create_collection(
                    collection_name=COLLECTION,
                    vectors_config=VectorParams(
                        size=VECTOR_SIZE,
                        distance=Distance.COSINE,
                    ),
                )
        return self._client

    def _get_embedder(self):
        """Load the fastembed model once and reuse it (loading is expensive)."""
        if self._embedder is None:
            from fastembed import TextEmbedding
            self._embedder = TextEmbedding("BAAI/bge-small-en-v1.5")
        return self._embedder

    async def _embed(self, text: str) -> list[float]:
        """Embed text using fastembed (bundled with qdrant-client[fastembed])."""
        embedder = self._get_embedder()
        vectors = list(embedder.embed([text]))
        return vectors[0].tolist()

    async def add(
        self,
        agent_id: str,
        content: str,
        task_type: str = "",
        metadata: dict | None = None,
    ) -> str:
        client = await self._get_client()
        memory_id = str(uuid.uuid4())
        vector = await self._embed(content)
        payload = {
            "agent_id": agent_id,
            "content": content,
            "task_type": task_type,
            "created_at": datetime.now(timezone.utc).isoformat(),
            **(metadata or {}),
        }
        await client.upsert(
            collection_name=COLLECTION,
            points=[PointStruct(id=memory_id, vector=vector, payload=payload)],
        )
        return memory_id

    async def search(
        self,
        agent_id: str,
        query: str,
        limit: int = 5,
    ) -> list[dict]:
        """Semantic search over this agent's memories."""
        try:
            client = await self._get_client()
            query_vector = await self._embed(query)
            results: list[ScoredPoint] = await client.search(
                collection_name=COLLECTION,
                query_vector=query_vector,
                query_filter=Filter(
                    must=[FieldCondition(key="agent_id", match=MatchValue(value=agent_id))]
                ),
                limit=limit,
                with_payload=True,
            )
            return [
                {
                    "id": str(r.id),
                    "content": r.payload.get("content", ""),
                    "task_type": r.payload.get("task_type", ""),
                    "created_at": r.payload.get("created_at", ""),
                    "score": r.score,
                }
                for r in results
            ]
        except Exception:
            return []

    async def list_memories(self, agent_id: str, limit: int = 50) -> list[dict]:
        """List all memories for an agent (no semantic search, just filter)."""
        try:
            client = await self._get_client()
            results, _ = await client.scroll(
                collection_name=COLLECTION,
                scroll_filter=Filter(
                    must=[FieldCondition(key="agent_id", match=MatchValue(value=agent_id))]
                ),
                limit=limit,
                with_payload=True,
            )
            return [
                {
                    "id": str(r.id),
                    "content": r.payload.get("content", ""),
                    "task_type": r.payload.get("task_type", ""),
                    "created_at": r.payload.get("created_at", ""),
                }
                for r in results
            ]
        except Exception:
            return []

    async def delete(self, memory_id: str) -> bool:
        try:
            client = await self._get_client()
            await client.delete(
                collection_name=COLLECTION,
                points_selector=[memory_id],
            )
            return True
        except Exception:
            return False

    async def close(self):
        if self._client:
            await self._client.close()
            self._client = None


# Module-level singleton
memory_manager = MemoryManager()
