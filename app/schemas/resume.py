from pydantic import BaseModel
from typing import Dict, Optional, List


class ResumeBase(BaseModel):
    raw_input: Dict
    profession: str

class ResumeOutput(BaseModel):
    generated_text: str
    sections: Dict
    pdf_url: Optional[str]

class AnalyzeRequest(BaseModel):
    jd_text: str
    company_url: Optional[str] = None


class ApplyChangesRequest(BaseModel):
    accepted_changes: List[str]   # например ["change1", "change4"]
