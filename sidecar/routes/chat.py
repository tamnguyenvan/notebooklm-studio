"""
Chat routes — ask, history, persona
"""
from __future__ import annotations
import json
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
        conv_id = body.conversation_id or _conversations.get(notebook_id)
        print(f"[sidecar:chat] ask notebook_id={notebook_id} conv_id={conv_id} message={body.message!r}", flush=True)

        result = await client.chat.ask(
            notebook_id,
            body.message,
            conversation_id=conv_id,
        )
        _conversations[notebook_id] = result.conversation_id

        print(f"[sidecar:chat] answer length={len(result.answer)} conversation_id={result.conversation_id}", flush=True)
        print(f"[sidecar:chat] raw references attr={getattr(result, 'references', 'MISSING')}", flush=True)

        followups = []
        try:
            followups = list(getattr(result, "suggested_followups", []) or [])
        except Exception as e:
            print(f"[sidecar:chat] followups error: {e}", flush=True)

        references = []
        try:
            raw_refs = result.references or []
            print(f"[sidecar:chat] references count={len(raw_refs)}", flush=True)
            for i, r in enumerate(raw_refs):
                print(f"[sidecar:chat]   ref[{i}] source_id={getattr(r,'source_id','?')} citation_number={getattr(r,'citation_number','?')} cited_text={getattr(r,'cited_text','?')!r}", flush=True)
            references = [_serialize_reference(r) for r in raw_refs]
        except Exception as e:
            print(f"[sidecar:chat] references error: {e}", flush=True)

        payload = {
            "answer": result.answer,
            "conversation_id": result.conversation_id,
            "turn_number": getattr(result, "turn_number", 0),
            "references": references,
            "suggested_followups": followups,
        }
        print(f"[sidecar:chat] returning payload keys={list(payload.keys())} references_serialized={json.dumps(references)}", flush=True)
        return payload
    except Exception as e:
        print(f"[sidecar:chat] exception: {e}", flush=True)
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
