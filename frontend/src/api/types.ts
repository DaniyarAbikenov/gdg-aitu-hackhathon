import type { components } from "./schema";

/** Response and request shapes generated from the backend OpenAPI schema. */
export type Schemas = components["schemas"];

export type ResumeRecord = Schemas["ResumeRecord"];
export type ProfileRecord = Schemas["ProfileRecord"];
export type ProfileData = Schemas["ProfileData"];
export type ProfileSave = Schemas["ProfileSave"];
export type InterviewView = Schemas["InterviewView"];
export type InterviewStartRequest = Schemas["InterviewStart"];
export type TranscriptTurn = Schemas["TranscriptTurn"];
export type PlanRecord = Schemas["PlanRecord"];
export type PlanModule = Schemas["PlanModule"];
export type PlanCreate = Schemas["PlanCreate"];
export type VersionRecord = Schemas["VersionRecord"];
export type Progress = Schemas["Progress"];
export type Overview = Schemas["Overview"];
export type Preferences = Schemas["PreferencesRecord"];
export type ApplicationItem = Schemas["ApplicationItem"];
export type ApplicationFields = Schemas["ApplicationFields"];
export type ApplicationPayload = Schemas["Application"];
export type CompanyPayload = Schemas["Company"];
export type TargetPayload = Schemas["Target"];
export type ArticlePayload = Schemas["Article"];
export type GenericRecord = Schemas["Record"];
