// API service for sending images to server for multi-pose detection
const API_BASE_URL = 'http://localhost:8000'; // Adjust this to your server URL

export class PoseApiService {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  // Send image to server for pose detection
  async detectPoses(imageData) {
    try {
      const formData = new FormData();
      
      // Convert data URL to blob
      const response = await fetch(imageData);
      const blob = await response.blob();
      
      formData.append('image', blob, 'capture.png');
      
      const result = await fetch(`${this.baseUrl}/detect-poses`, {
        method: 'POST',
        body: formData,
      });

      if (!result.ok) {
        throw new Error(`HTTP error! status: ${result.status}`);
      }

      const data = await result.json();
      return data;
    } catch (error) {
      console.error('Error sending image to server:', error);
      throw error;
    }
  }

  // Get server status
  async getServerStatus() {
    try {
      const response = await fetch(`${this.baseUrl}/status`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error checking server status:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const poseApi = new PoseApiService();
