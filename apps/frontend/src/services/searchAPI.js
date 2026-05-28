// Search API service — routes all searches through the backend /api/search endpoint

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

class SearchAPI {
  // Main search orchestrator — delegates to backend
  async performUnbiasedSearch(query, filters = {}) {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const response = await fetch(`${BACKEND_URL}/api/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, filters }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Search failed (${response.status})`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Search returned unsuccessful');
      }

      return data.results || [];
    } catch (error) {
      console.error('Search error:', error);
      throw new Error('Search service unavailable');
    }
  }
}

export default SearchAPI;
