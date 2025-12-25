import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

export const loginUser = (credentials) =>
  API.post("/api/auth/login", credentials);

export const refreshToken = () => API.post("/api/auth/refresh");

export const logoutUser = () => API.post("/api/auth/logout");
