from langchain_core.messages import AIMessage, HumanMessage
from langgraph.types import interrupt
from state import MedicalState


def PatientResponse(state: MedicalState) -> dict:
    """Waits for the patient's answer to the last question asked and stores it
    in state["message"] as a new human message.

    `interrupt()` pauses the graph here and saves its state in the checkpointer.
    The HTTP API resumes it later with `graph.invoke(Command(resume=answer), config)`,
    and `interrupt()` then returns that answer. (Replaces the old `input()`, which
    would block a web server forever.)

    On resume LangGraph re-runs this node from the top, so it must have no side
    effects before the `interrupt()` call.
    """
    last_question = next(
        (m.content for m in reversed(state["message"]) if isinstance(m, AIMessage)),
        "",
    )
    answer = interrupt({"question": last_question})
    return {"message": [HumanMessage(content=answer)]}
