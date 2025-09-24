// API Configuration
const URL = "103.78.3.31";
export const API_CONFIG = {
  // Base URL for the Python pose estimation API
  BASE_URL: `https://${URL}`,
  // API endpoints
  ENDPOINTS: {
    ANALYZE_POSE: "/image",
    WEBSOCKET: "/ws",
  },

  // Request settings
  REQUEST_TIMEOUT: 30000, // 30 seconds
  IMAGE_QUALITY: 0.8, // JPEG quality for image compression

  // WebSocket settings
  WS_RECONNECT_ATTEMPTS: 5,
  WS_RECONNECT_DELAY: 1000, // 1 second

  // Frame rate settings
  MAX_FRAME_RATE: 30,
  MIN_FRAME_INTERVAL: 1000 / 30, // milliseconds
};

// Helper function to get full API URL
export const getApiUrl = (endpoint) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Helper function to get WebSocket URL
export const getWsUrl = () => {
  return API_CONFIG.BASE_URL;
};

export default API_CONFIG;
