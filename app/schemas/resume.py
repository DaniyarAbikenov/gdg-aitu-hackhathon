from pydantic import BaseModel
from typing import Dict, Optional

class ResumeBase(BaseModel):
    raw_input: Dict
    profession: str

class ResumeOutput(BaseModel):
    generated_text: str
    sections: Dict
    pdf_url: Optional[str]
