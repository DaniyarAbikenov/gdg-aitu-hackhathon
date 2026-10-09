import type { components } from "./schema";

/** Response and request shapes generated from the backend OpenAPI schema. */
export type Schemas = components["schemas"];

export type ResumeRecord = Schemas["ResumeRecord"];
export type ProfileRecord = Schemas["ProfileRecord"];
export type InterviewView = Schemas["InterviewView"];
export type PlanRecord = Schemas["PlanRecord"];
export type PlanModule = Schemas["PlanModule"];
export type VersionRecord = Schemas["VersionRecord"];
export type Progress = Schemas["Progress"];
export type Overview = Schemas["Overview"];
export type Preferences = Schemas["PreferencesRecord"];
export type ApplicationItem = Schemas["ApplicationItem"];
export type ApplicationFields = Schemas["ApplicationFields"];
export type GenericRecord = Schemas["Record"];
