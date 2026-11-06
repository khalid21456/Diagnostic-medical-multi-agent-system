"""HTTP routes that drive the LangGraph consultation graph.

One consultation = one LangGraph thread (`thread_id = session_id`). The graph
pauses at `patient_response` (via `interrupt()`) waiting for each answer, and
before `report_agent` (via `interrupt_before`) after the last one.
`graph.get_state(config).next` tells us where it is paused:

    ("patient_response",)  → waiting for an answer
    ("report_agent",)      → all answers in, report not generated yet
    ()                     → finished, `final_report` is in the state

Routes are plain `def` (not `async def`): `graph.invoke` blocks while it calls
OpenAI, and FastAPI runs sync routes in a thread pool so the server stays responsive.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from langchain_core.messages import AIMessage
from langgraph.types import Command

from graph import build_graph
from nodes.diagnostic_agent import MAX_QUESTIONS
from schemas import (
    DiagnosisReport,
    StartSessionResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

# Compiled once; the checkpointer inside keeps every session's state.
graph = build_graph()

AWAITING_ANSWER = ("patient_response",)
AWAITING_REPORT = ("report_agent",)


def _config(session_id: str) -> dict:
    return {"configurable": {"thread_id": session_id}}


def _snapshot(session_id: str):
    snapshot = graph.get_state(_config(session_id))
    if not snapshot.values:
        raise HTTPException(
            status_code=404,
            detail="Session not found. It may have expired after a server restart. "
            "Please start a new consultation.",
        )
    return snapshot


def _run(graph_input: Any, session_id: str) -> None:
    """Runs the graph until its next pause, turning model/API failures into a 502."""
    try:
        graph.invoke(graph_input, _config(session_id))
    except Exception as exc:
        log.exception("Graph run failed for session %s", session_id)
        raise HTTPException(
            status_code=502,
            detail="The diagnostic service failed to respond. Please try again.",
        ) from exc


def _last_question(values: dict) -> str:
    for message in reversed(values["message"]):
        if isinstance(message, AIMessage):
            return message.content if isinstance(message.content, str) else str(message.content)
    raise HTTPException(status_code=500, detail="No question was generated.")


@router.post("", response_model=StartSessionResponse)
def start_session() -> StartSessionResponse:
    """Creates a session and runs the graph until it asks the first question."""
    session_id = str(uuid.uuid4())
    _run({"message": [], "question_count": 0}, session_id)
    values = _snapshot(session_id).values
    return StartSessionResponse(
        session_id=session_id,
        question=_last_question(values),
        question_number=values["question_count"],
        total_questions=MAX_QUESTIONS,
    )


@router.post(
    "/{session_id}/answers",
    response_model=SubmitAnswerResponse,
    response_model_exclude_none=True,
)
def submit_answer(session_id: str, body: SubmitAnswerRequest) -> SubmitAnswerResponse:
    """Resumes the graph with the patient's answer; returns the next question or `complete`."""
    snapshot = _snapshot(session_id)

    if snapshot.next == AWAITING_ANSWER:
        # interrupt() inside patient_response returns body.answer.
        _run(Command(resume=body.answer.strip()), session_id)
    elif snapshot.next == AWAITING_REPORT:
        pass  # all answers already in (a retried request): just say "complete" again
    elif snapshot.next:
        # A previous request failed mid-run (e.g. OpenAI error after the answer was
        # saved). The answer is already in the state, so just continue the run.
        _run(None, session_id)
    else:
        raise HTTPException(status_code=409, detail="This consultation is already finished.")

    snapshot = _snapshot(session_id)
    if snapshot.next == AWAITING_ANSWER:
        return SubmitAnswerResponse(
            status="question",
            question=_last_question(snapshot.values),
            question_number=snapshot.values["question_count"],
            total_questions=MAX_QUESTIONS,
        )
    return SubmitAnswerResponse(status="complete")


@router.get("/{session_id}/report", response_model=DiagnosisReport, response_model_exclude_none=True)
def get_report(session_id: str) -> DiagnosisReport:
    """Generates the report on first call (runs report_agent), then returns the stored one."""
    snapshot = _snapshot(session_id)

    if not snapshot.values.get("final_report"):
        if snapshot.next != AWAITING_REPORT:
            raise HTTPException(
                status_code=409,
                detail="Answer all the questions before requesting the report.",
            )
        _run(None, session_id)  # resume past interrupt_before → report_agent runs
        snapshot = _snapshot(session_id)

    return DiagnosisReport(
        session_id=session_id,
        generated_at=snapshot.created_at or datetime.now(timezone.utc).isoformat(),
        markdown=snapshot.values["final_report"],
        summary=snapshot.values.get("diagnostic_summary") or None,
    )
