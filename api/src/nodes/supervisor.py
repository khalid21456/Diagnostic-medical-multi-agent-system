from state import MedicalState
from typing_extensions import Literal
from IPython.display import Markdown


def supervisor(state:MedicalState) -> dict:
    if state.get("final_report"):
        # display(Markdown(state["final_report"]))
        return {"next" : "END"}
    if state["question_count"] < 5:
        return {"next" : "diagnostic_agent"}
    if state["question_count"] == 5:
        return {"next" : "report_agent"}



def route_after_supervisor(state: MedicalState) -> Literal["diagnostic_agent","report_agent","END"]:
    return state["next"]
    

