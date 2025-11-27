// API base URL - defaults to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// Auth APIs
export const authAPI = {
  register: async (email, password, name) => {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    return res.json();
  },

  login: async (email, password) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Continue with local cleanup even if API call fails
      }
    }
    // Clear all auth-related storage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('eternal_session');
    localStorage.removeItem('eternal_connections');
    // Clear session storage as well
    sessionStorage.clear();
  },

  getMe: async () => {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  refresh: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return null;
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    return res.json();
  },
};

// Memories APIs
export const memoriesAPI = {
  list: async (page = 1, limit = 20, search = '') => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.append('search', search);
    const res = await fetch(`${API_BASE_URL}/memories?${params.toString()}`);
    return res.json();
  },

  get: async (id) => {
    const res = await fetch(`${API_BASE_URL}/memories/${id}`);
    return res.json();
  },

  create: async (data) => {
    const res = await fetch(`${API_BASE_URL}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  update: async (id, data) => {
    const res = await fetch(`${API_BASE_URL}/memories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_BASE_URL}/memories/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  like: async (id) => {
    const res = await fetch(`${API_BASE_URL}/memories/${id}/like`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  unlike: async (id) => {
    const res = await fetch(`${API_BASE_URL}/memories/${id}/unlike`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  getComments: async (id) => {
    const res = await fetch(`${API_BASE_URL}/memories/${id}/comments`);
    return res.json();
  },

  addComment: async (id, text) => {
    const res = await fetch(`${API_BASE_URL}/memories/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ text }),
    });
    return res.json();
  },
};

// Connections APIs
export const connectionsAPI = {
  list: async () => {
    const res = await fetch(`${API_BASE_URL}/connections`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  toggle: async (appId) => {
    const res = await fetch(`${API_BASE_URL}/connections/${appId}/toggle`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // Initialize OAuth flow - returns the OAuth URL to navigate to
  // Uses POST to avoid exposing tokens in URL
  initConnect: async (appId) => {
    const res = await fetch(`${API_BASE_URL}/connections/${appId}/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    });
    return res.json();
  },

  // Import media from connected account
  import: async (appId, limit = 20) => {
    const res = await fetch(`${API_BASE_URL}/connections/${appId}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ limit }),
    });
    return res.json();
  },

  // Disconnect an app
  disconnect: async (appId) => {
    const res = await fetch(`${API_BASE_URL}/connections/${appId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return res.json();
  },
};

// Mirror (AI assistant) APIs
export const mirrorAPI = {
  sendMessage: async (message) => {
    const res = await fetch(`${API_BASE_URL}/mirror/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ message }),
    });
    return res.json();
  },
};

// Upload API
export const uploadAPI = {
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    return res.json();
  },
};
