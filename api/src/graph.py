from langgraph.graph import StateGraph, START, END
from IPython.display import Image, Markdown, display
from state import MedicalState
from nodes.diagnostic_agent import DiagnosticAgent 
from nodes.patient_response import PatientResponse 
from nodes.report_agent import report_agent
from nodes.supervisor import supervisor, route_after_supervisor 

builder = StateGraph(MedicalState)
builder.add_node("supervisor",supervisor)
builder.add_node("report_agent",report_agent)
builder.add_node("diagnostic_agent",DiagnosticAgent)
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
builder.add_edge("report_agent","supervisor")



def build_graph():
    return builder.compile()