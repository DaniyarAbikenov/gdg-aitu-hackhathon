import client from "./client";
import axios from "axios";

export async function uploadResume(file: File) {
    const form = new FormData();
    form.append("file", file);

    const resp = await client.post("/resume/upload", form, {
        headers: { "Content-Type": "multipart/form-data" }
    });

    return resp.data; // { resume_id, gs_url }
}

export async function getResume(resumeId: string) {
    const resp = await client.get(`/resume/${resumeId}`);
    return resp.data;
}

export async function parseResume(resumeId: string) {
    const resp = await client.post(`/resume/${resumeId}/parse`);
    return resp.data; // { fields: {...} }
}


export async function extractResume(resumeId: string) {
    const resp = await client.post(`/resume/${resumeId}/extract`);
    return resp.data; // { fields }
}


export async function updateResumeFields(resumeId: string, fields: any) {
    const resp = await client.post(`/resume/${resumeId}/update-fields`, fields);
    return resp.data;
}

export async function getRecommendations(resumeId: string, payload: any) {
    const resp = await client.post(`/resume/${resumeId}/recommendations`, payload);
    return resp.data;
}

export async function applyRecommendations(resumeId: string) {
    const resp = await client.post(`/resume/${resumeId}/apply`);
    return resp.data;
}

export async function generateResume(resumeId: string, template: string) {
    const resp = await client.post(`/resume/${resumeId}/generate`, { template });
    return resp.data; // { pdf_url, html }
}

export async function saveResumeFields(resumeId: string, fields: any) {
    const resp = await client.post(`/resume/${resumeId}/save`, { fields });
    return resp.data;
}

export async function improveResume(resumeId: string, jdText: string) {
    const resp = await client.post(`/resume/${resumeId}/improve`, {
        jd_text: jdText
    });
    return resp.data;
}

export const getResumeImprovements = async (resumeId: string) => {
    const response = await client.post(`/resume/${resumeId}/improve`, {
        jd_text: "Job description text here",  // Пример текста вакансии
    });
    return response.data;
};

