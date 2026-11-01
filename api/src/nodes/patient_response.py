from langchain_core.messages import HumanMessage
from state import MedicalState

def PatientResponse(state: MedicalState) -> dict:
    """Prompts the patient for their answer to the last question asked
    and stores it in state["message"] as a new human message.
    """
    answer = input("Your answer: ")
    return {"message": [HumanMessage(content=answer)]}