import { io } from "socket.io-client";
import API_CONFIG, { getApiUrl, getWsUrl } from "../config/api.js";

class PoseApiService {
  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
    this.wsUrl = getWsUrl();
    this.socket = null;
    this.isConnected = false;
    this.onMessageCallback = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = API_CONFIG.WS_RECONNECT_ATTEMPTS;
  }

  // Initialize WebSocket (Socket.IO) connection
  connectWebSocket(onMessage) {
    // Prevent multiple connections
    if (this.socket && this.socket.connected) {
      console.log("Socket.IO already connected, updating callback only");
      this.onMessageCallback = onMessage;
      return;
    }

    // Disconnect existing socket if any
    if (this.socket) {
      this.socket.disconnect();
    }

    try {
      this.onMessageCallback = onMessage;
      this.socket = io(this.wsUrl, {
        transports: ["websocket", "polling"], // Allow both transports
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: API_CONFIG.WS_RECONNECT_DELAY,
        forceNew: true, // Force new connection
        timeout: 10000, // 10 second timeout
      });

      this.socket.on("connect", () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log("✅ WebSocket connected successfully");
      });

      this.socket.on("disconnect", (reason) => {
        this.isConnected = false;
        console.log("❌ WebSocket disconnected:", reason);
      });

      this.socket.on("connect_error", (error) => {
        console.error("Socket.IO connection error:", error);
        this.isConnected = false;
      });

      // Handle pose results from server
      this.socket.on("pose_result", (data) => {
        if (this.onMessageCallback) {
          this.onMessageCallback(data);
        }
      });
    } catch (error) {
      console.error("Error connecting to Socket.IO:", error);
      this.isConnected = false;
    }
  }

  // Disconnect WebSocket
  disconnectWebSocket() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Send frame for real-time pose analysis
  async sendFrameForAnalysis(imageData) {
    if (!this.socket || !this.isConnected) {
      console.log("Cannot send frame - socket:", !!this.socket, "connected:", this.isConnected);
      return false;
    }

    try {
      // imageData is already binary data from the calling function
      // Send binary image data directly
      this.socket.emit("frame", imageData);
      console.log("Frame emitted to server");
      return true;
    } catch (error) {
      console.error("Error sending frame:", error);
      return false;
    }
  }


  // Analyze single image via REST API
  async analyzeImage(imageData) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        API_CONFIG.REQUEST_TIMEOUT
      );

      // Build form data with JPEG binary
      const formData = new FormData();

      // Convert imageData to JPEG blob if needed
      let jpegBlob;
      if (imageData instanceof Blob) {
        jpegBlob = imageData;
      } else if (imageData instanceof ArrayBuffer) {
        jpegBlob = new Blob([imageData], { type: "image/jpeg" });
      } else if (typeof imageData === "string") {
        // Base64 string - convert to blob
        const binaryString = atob(imageData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        jpegBlob = new Blob([bytes], { type: "image/jpeg" });
      } else if (imageData instanceof HTMLImageElement) {
        // HTMLImageElement - convert to blob using canvas
        const canvas = document.createElement("canvas");
        canvas.width = imageData.naturalWidth;
        canvas.height = imageData.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(imageData, 0, 0);

        // Convert canvas to blob
        jpegBlob = await new Promise((resolve) => {
          canvas.toBlob(resolve, "image/jpeg", 0.85);
        });
      } else {
        throw new Error("Unsupported image data format");
      }

      formData.append("file", jpegBlob, "image.jpg");

      const response = await fetch(
        getApiUrl(API_CONFIG.ENDPOINTS.ANALYZE_POSE),
        {
          method: "POST",
          body: formData,
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Error analyzing image:", error);
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
    };
  }
}

export default PoseApiService;
