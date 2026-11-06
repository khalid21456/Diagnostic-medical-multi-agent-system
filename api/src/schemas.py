"""Request/response models for the web API.

These mirror `web/src/types/diagnosis.ts`. Fields are snake_case in Python and
serialized as camelCase in JSON (`session_id` → `sessionId`) so the frontend
gets exactly the shape it expects.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class StartSessionResponse(CamelModel):
    session_id: str
    question: str
    question_number: int
    total_questions: int


class SubmitAnswerRequest(CamelModel):
    answer: str = Field(min_length=1, max_length=1000)


class SubmitAnswerResponse(CamelModel):
    """`status="question"` carries the next question; `status="complete"` has no
    other fields (they're dropped from the JSON with `response_model_exclude_none`)."""

    status: Literal["question", "complete"]
    question: str | None = None
    question_number: int | None = None
    total_questions: int | None = None


class DiagnosisReport(CamelModel):
    session_id: str
    generated_at: str
    markdown: str
    summary: str | None = None
    urgency: Literal["low", "moderate", "high", "emergency"] | None = None
