from langchain.chat_models import init_chat_model
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, ToolMessage
from state import MedicalState
from tools.web_search import web_search

_base_llm = init_chat_model("openai:gpt-5-mini")
report_agent_llm = _base_llm.bind_tools([web_search])
# Same model, but forbidden from calling tools: used to force a final answer.
_final_llm = _base_llm.bind_tools([web_search], tool_choice="none")

MAX_TOOL_ROUNDS = 3

REPORT_AGENT_PROMPT = (
    "You are a reporter agent. Your job is to generate a report about the patient's "
    "situation based on the following intake conversation, and propose solutions and "
    "medicaments. You may search the web for up-to-date medical information.\n\n"
    "Write the report in Markdown with these sections: '## Reported symptoms', "
    "'## Preliminary assessment', '## Suggested treatment', '## When to see a doctor'. "
    "Do not repeat these instructions.\n\n"
    "Conversation:\n{messages}"
)


def _text(message: BaseMessage) -> str:
    """Message content as plain text (content can be a string or a list of parts)."""
    if isinstance(message.content, str):
        return message.content
    return "".join(
        part.get("text", "") if isinstance(part, dict) else str(part)
        for part in message.content
    )


def report_agent(state: MedicalState) -> dict:
    """Writes the final report from the 5-question conversation.

    The model can call `web_search`; those tool calls are executed here and the
    results sent back, for at most MAX_TOOL_ROUNDS rounds.
    """
    transcript = "\n".join(
        f"{'Assistant' if isinstance(m, AIMessage) else 'Patient'}: {_text(m)}"
        for m in state["message"]
    )
    messages: list[BaseMessage] = [
        HumanMessage(content=REPORT_AGENT_PROMPT.format(messages=transcript))
    ]

    reply = report_agent_llm.invoke(messages)
    for _ in range(MAX_TOOL_ROUNDS):
        if not reply.tool_calls:
            break
        messages.append(reply)
        for call in reply.tool_calls:
            result = web_search.invoke(call["args"])
            messages.append(ToolMessage(content=str(result), tool_call_id=call["id"]))
        reply = report_agent_llm.invoke(messages)

    if reply.tool_calls:
        # Still asking for searches after the limit: make it answer with what it has.
        reply = _final_llm.invoke(messages)

    return {"final_report": _text(reply)}
