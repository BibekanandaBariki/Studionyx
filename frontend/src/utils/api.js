import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 30000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.message ||
      'Something went wrong. Please try again.';
    return Promise.reject(new Error(message));
  },
);

export const ingestMaterials = () => api.post('/ingest').then((res) => res.data);
export const askQuestion = (question) =>
  api.post('/ask', { question }).then((res) => res.data);
export const dialogueTurn = (message) =>
  api.post('/dialogue', { message }).then((res) => res.data);
export const fetchSummary = () => api.post('/summary').then((res) => res.data);
export const fetchStats = () => api.get('/stats').then((res) => res.data);
export const fetchHistory = () => api.get('/history').then((res) => res.data);
export const clearHistory = () => api.post('/clear-history').then((res) => res.data);
export const testGemini = () => api.get('/test-gemini').then((res) => res.data);

// Source management APIs
export const uploadFile = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((res) => res.data);
};

export const addSource = (sourceData) =>
  api.post('/sources/add', sourceData).then((res) => res.data);

export const fetchSources = () => api.get('/sources').then((res) => res.data);

export const removeSource = (id) =>
  api.delete(`/sources/${id}`).then((res) => res.data);

export const clearSources = () => api.post('/sources/clear').then((res) => res.data);

export const fetchSuggestedQuestions = () => api.post('/suggest-questions').then((res) => res.data);


export default api;


