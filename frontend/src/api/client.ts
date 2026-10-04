import axios from "axios";
const client = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 90000,
});
client.interceptors.response.use(
  (response) => response,
  (error) => {
    error.message = error.response?.data?.detail || error.message;
    return Promise.reject(error);
  },
);
export default client;
