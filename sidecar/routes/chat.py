"""
Chat routes — ask, history, persona
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.client import get_client

router = APIRouter(prefix="/notebooks", tags=["chat"])

# In-memory conversation state per notebook (conversation_id for follow-ups)
_conversations: dict[str, str] = {}  # notebook_id -> conversation_id


class AskBody(BaseModel):
    message: str
    conversation_id: str | None = None


class PersonaBody(BaseModel):
    instructions: str


def _serialize_reference(ref) -> dict:
    return {
        "source_id": getattr(ref, "source_id", ""),
        "citation_number": getattr(ref, "citation_number", None),
        "cited_text": getattr(ref, "cited_text", None),
    }


@router.post("/{notebook_id}/chat")
async def send_message(notebook_id: str, body: AskBody, client=Depends(get_client)):
    try:
        # Use stored conversation_id for continuity unless caller overrides
        conv_id = body.conversation_id or _conversations.get(notebook_id)
        result = await client.chat.ask(
            notebook_id,
            body.message,
            conversation_id=conv_id,
        )
        # Persist conversation_id for follow-ups
        _conversations[notebook_id] = result.conversation_id

        # Build suggested follow-ups list — notebooklm-py doesn't expose them
        # directly on AskResult; fall back to empty list gracefully.
        followups = []
        try:
            followups = list(getattr(result, "suggested_followups", []) or [])
        except Exception:
            pass

        references = []
        try:
            references = [_serialize_reference(r) for r in (result.references or [])]
        except Exception:
            pass

        return {
            "answer": result.answer,
            "conversation_id": result.conversation_id,
            "turn_number": getattr(result, "turn_number", 0),
            "references": references,
            "suggested_followups": followups,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})


@router.get("/{notebook_id}/chat/history")
async def get_chat_history(notebook_id: str, client=Depends(get_client)):
    """
    Returns Q&A pairs from the most recent conversation as a flat message list.
    notebooklm-py returns list[tuple[str, str]] — (question, answer) pairs.
    """
    try:
        pairs = await client.chat.get_history(notebook_id, limit=100)
        messages = []
        for i, (question, answer) in enumerate(pairs):
            messages.append({
                "id": f"user-{i}",
                "role": "user",
                "content": question,
                "references": [],
                "suggested_followups": [],
            })
            messages.append({
                "id": f"assistant-{i}",
                "role": "assistant",
                "content": answer,
                "references": [],
                "suggested_followups": [],
            })
        return messages
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})


@router.put("/{notebook_id}/chat/persona")
async def set_persona(notebook_id: str, body: PersonaBody, client=Depends(get_client)):
    try:
        from notebooklm import ChatGoal
        await client.chat.configure(
            notebook_id,
            goal=ChatGoal.CUSTOM,
            custom_prompt=body.instructions,
        )
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})
