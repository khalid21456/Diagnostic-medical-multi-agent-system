from langchain.chat_models import init_chat_model
from state import MedicalState
from tools.web_search import web_search

report_agent_llm = init_chat_model("openai:gpt-5-mini").bind_tools([web_search])

REPORT_AGENT_PROMPT= "You are a reporter agent, your job is to generate a report about the patient situation based on {messages} propose solutions and medicaments."

def report_agent(state:MedicalState) -> dict:
    """
        You are a reporter agent, your job is to genarte a report to the patient
    """
    messages = state["message"]
    entretien = ""
    print("Inside the report agent")
    for p in messages:
        entretien = entretien+" "+p.content
    report = report_agent_llm.invoke(REPORT_AGENT_PROMPT.format(messages=entretien))
    state["question_count"] = state["question_count"] + 10
    return {"final_report":report.content}
    