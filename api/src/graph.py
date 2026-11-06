from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import StateGraph, START, END
from state import MedicalState
from nodes.diagnostic_agent import DiagnosticAgent
from nodes.patient_response import PatientResponse
from nodes.report_agent import report_agent
from nodes.supervisor import supervisor, route_after_supervisor

builder = StateGraph(MedicalState)
builder.add_node("supervisor", supervisor)
builder.add_node("report_agent", report_agent)
builder.add_node("diagnostic_agent", DiagnosticAgent)
builder.add_edge(START, "supervisor")
builder.add_conditional_edges(
    "supervisor",
    route_after_supervisor,
    {
        "diagnostic_agent": "diagnostic_agent",
        "report_agent": "report_agent",
        "END": END,
    },
)
builder.add_node("patient_response", PatientResponse)
builder.add_edge("diagnostic_agent", "patient_response")
builder.add_edge("patient_response", "supervisor")
builder.add_edge("report_agent", "supervisor")


def build_graph():
    """Compiles the graph for the web API.

    - checkpointer: saves each session's state between HTTP requests, keyed by
      `thread_id`. InMemorySaver loses everything on restart — swap for
      SqliteSaver/PostgresSaver to persist sessions.
    - interrupt_before=["report_agent"]: pause after the 5th answer so the API
      can answer "complete" right away and generate the (slow) report in a
      separate request.
    """
    return builder.compile(
        checkpointer=InMemorySaver(),
        interrupt_before=["report_agent"],
    )
