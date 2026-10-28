from state import MedicalState
from langchain.chat_models import init_chat_model
from langchain_core.messages import SystemMessage


diagnostic_agent_llm = init_chat_model("openai:gpt-5-mini")

MAX_QUESTIONS = 5

DIAGNOSTIC_SYSTEM_PROMPT = (
    "You are a diagnostic intake agent for a medical triage assistant. "
    "Ask the patient exactly one short, clear, relevant question at a time "
    "to understand their symptoms, history, and condition, building on "
    "their previous answers. Reply with only the question itself — no "
    "preamble, no diagnosis, no advice."
)


def DiagnosticAgent(state: MedicalState) -> dict:
    """Asks the patient one diagnostic question per invocation.

    Meant to be called once per question (MAX_QUESTIONS times total): it
    reads the conversation so far from state["message"] (the latest human
    message being the patient's most recent answer) and appends the agent's
    next question as a new AI message, bumping question_count by one.

    Note: diagnostic_summary is NOT produced here. By the time this node
    would see question_count == MAX_QUESTIONS, the patient's answer to the
    final question hasn't been added to state yet, and nothing currently
    calls this node again afterward to pick it up — the supervisor routes
    away as soon as question_count == 5. Summarizing needs its own step
    once the graph wiring (and the supervisor's routing for counts 1-4,
    which it doesn't handle yet either) is decided.
    """
    question_count = state.get("question_count", 0)
    history = [SystemMessage(content=DIAGNOSTIC_SYSTEM_PROMPT), *state["message"]]

    if question_count == MAX_QUESTIONS - 1:
        history.append(SystemMessage(
            content="This is the final question — after it, no more will be asked."
        ))

    question = diagnostic_agent_llm.invoke(history)

    return {
        "message": [question],
        "question_count": question_count + 1,
    }



