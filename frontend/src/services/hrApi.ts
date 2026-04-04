import axios from "axios";
import { authStorage } from "./api";

const rawApiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_BASE_URL = rawApiUrl.endsWith("/api") ? rawApiUrl : `${rawApiUrl}/api`;

const API = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

API.interceptors.request.use((config) => {
  const token = authStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface LetterItem {
  _id: string;
  title?: string;
  type?: string;
  letterNumber?: string;
  status?: string;
  issuedDate?: string;
  createdAt: string;
}

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

type LetterGenerationPayload = Record<string, unknown>;

export const lettersApi = {
  getMyLetters: async () => {
    const response = await API.get<ApiEnvelope<LetterItem[]>>("/letters/my");
    return response.data.data || [];
  },
  generateLetter: (data: LetterGenerationPayload) => API.post("/letters/generate", data),
  getAllGeneratedLetters: () => API.get("/letters/generated"),
  downloadLetter: (id: string) =>
    API.get(`/letters/${id}/download`, {
      responseType: "blob",
    }),
  exportLettersCsv: () =>
    API.get("/letters/export/csv", {
      responseType: "blob",
    }),
  getLetterAnalytics: () => API.get("/letters/analytics"),
};
