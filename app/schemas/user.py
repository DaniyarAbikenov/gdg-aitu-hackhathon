from typing import List, Optional, Any, Dict

from pydantic import BaseModel


class EducationItem(BaseModel):
    institution: Optional[str] = None
    degree: Optional[str] = None
    year_start: Optional[int] = None
    year_end: Optional[int] = None


class ExperienceItem(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    achievements: Optional[List[str]] = None


class ProjectItem(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    tech: Optional[List[str]] = None


class CertificateItem(BaseModel):
    title: Optional[str] = None
    provider: Optional[str] = None
    year: Optional[int] = None


class UserProfile(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    desired_position: Optional[str] = None
    career_goal: Optional[str] = None

    skills: Optional[List[str]] = None
    education: Optional[List[EducationItem]] = None
    work_experience: Optional[List[ExperienceItem]] = None
    projects: Optional[List[ProjectItem]] = None
    certificates: Optional[List[CertificateItem]] = None

    # для гибких дополнительных данных
    extra: Optional[Dict[str, Any]] = None
