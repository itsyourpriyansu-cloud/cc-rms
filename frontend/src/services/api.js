import axios from 'axios';

// Create standard Axios instance ready for FastAPI backend connection
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-RMS-Client': 'customer-web',
  },
  timeout: 10000,
});

// Helper simulation of Network latency for realistic testing without live backend
export const mockApiDelay = (data, delay = 400) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ data, status: 200, success: true });
    }, delay);
  });
};

export default api;
