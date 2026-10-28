from state import MedicalState
from langchain.chat_models import init_chat_model
from typing_extensions import Literal



def supervisor(state:MedicalState) -> dict:
    if state["question_count"] < 5:
        return {"next" : "diagnostic_agent"}
    if state["question_count"] == 5:
        return {"next" : "physician_review"}
    # if state["physician_treatment"] != None:
    #     return {"next" : "report_agent"}
    # if state["final_report"] != None:
    #     return {"next" : "FINISH"}



def route_afte_supervisor(state: MedicalState) -> Literal["diagnostic_agent","physician_review","report_agent","FINISH"]:
    return state["next"]
    
