import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 120000, // Increased to 120 seconds for Gemini API calls
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[API] Request failed:', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });

    const message =
      error.response?.data?.message ||
      error.message ||
      'Something went wrong. Please try again.';

    const err = new Error(message);
    err.response = error.response;
    err.status = error.response?.status;
    return Promise.reject(err);
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

export const fetchSuggestedQuestions = async () => {
  console.log('[API] Fetching suggested questions...');
  try {
    const response = await api.post('/suggest-questions');
    console.log('[API] Suggested questions response:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API] Failed to fetch suggested questions:', error);
    // If it's a 400 error with fallback questions, return them
    if (error.status === 400 && error.response?.data?.questions) {
      console.log('[API] Returning fallback questions from 400 response');
      return error.response.data;
    }
    throw error;
  }
};

// Notebook management APIs
export const listNotebooks = () => api.get('/notebooks').then((res) => res.data);
export const createNotebook = (name) => api.post('/notebooks', { name }).then((res) => res.data);
export const activateNotebook = (id) => api.post(`/notebooks/${id}/activate`).then((res) => res.data);
export const renameNotebook = (id, name) => api.post(`/notebooks/${id}/rename`, { name }).then((res) => res.data);
export const deleteNotebook = (id) => api.delete(`/notebooks/${id}`).then((res) => res.data);

export default api;

