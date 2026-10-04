import client from "./client";

export interface UpdateProfileRequest {
    full_name?: string;
    email?: string;
    desired_position?: string;
    career_goal?: string;
    skills?: string[];
    extra?: Record<string, any>;
}

/**
 * Получение данных профиля пользователя
 * GET /user/profile
 */
export async function getUserProfile() {
    const resp = await client.get("/user/profile");
    return resp.data;
}

/**
 * Обновление профиля
 * POST /user/profile/update
 */
export async function updateUserProfile(data: UpdateProfileRequest) {
    const resp = await client.post("/user/profile/update", data);
    return resp.data;
}
