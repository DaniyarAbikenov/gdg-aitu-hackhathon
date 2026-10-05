import axios from "axios";
const client = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 90000,
});
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = error.response?.data?.detail;
    error.message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail
              .map(
                (item) =>
                  `${item.loc?.slice(1).join(" → ") || "Поле"}: ${item.msg || "проверьте значение"}`,
              )
              .join("; ")
          : error.message;

    return Promise.reject(error);
  },
);
export default client;
