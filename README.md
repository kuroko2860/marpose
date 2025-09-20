# 📸 Pose Capture & Analysis

A React application for manual pose capture and server-side analysis using AI.

## ✨ Features

- **Always-running Webcam**: Continuous camera feed for easy capture
- **Manual Image Capture**: Single-click capture with instant analysis
- **Server-side Processing**: Multi-pose detection via API calls
- **Client-side Analysis**: Real-time response processing and display
- **Training Session Management**: Organize captures by training sessions
- **Image Storage & Review**: Save and review all captured images
- **Server Status Monitoring**: Real-time connection status

## 🚀 Getting Started

### Client Setup

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

### Server Setup (Example)

1. Install Python dependencies:

```bash
pip install flask flask-cors opencv-python pillow numpy
```

2. Run the example server:

```bash
python server-example.py
```

The server will be available at `http://localhost:8000`

## 🎯 How It Works

1. **Start Camera**: Click "Start Camera" to begin webcam feed
2. **Start Training Session**: Click "Start Training Session" to begin a new session
3. **Capture Images**: Click "Capture Image" to manually capture and analyze poses
4. **Server Processing**: Images are sent to server for multi-pose detection
5. **Client Analysis**: Results are displayed with pose data and analysis
6. **Review Results**: View captured images with pose analysis in the right panel
7. **Reset Session**: Click "Reset Session" to clear all captured images

## 🔧 Technical Stack

- **React 19** - Modern React with hooks
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Flask** - Python web framework (server example)
- **OpenCV** - Computer vision library (server example)

## 📡 API Endpoints

The client communicates with the server via these endpoints:

- `GET /status` - Check server status
- `POST /detect-poses` - Send image for pose detection

## 📋 Server Response Format

```json
{
  "poses": [
    {
      "id": 1,
      "keypoints": [{ "x": 100, "y": 100, "score": 0.9 }],
      "score": 0.85
    }
  ],
  "analysis": {
    "total_poses": 1,
    "confidence": 0.85,
    "detection_time": "0.1s"
  },
  "success": true
}
```

## ⚙️ Configuration

Update the API base URL in `src/services/poseApi.js`:

```javascript
const API_BASE_URL = "http://localhost:8000"; // Your server URL
```

## 🗑️ Features Removed

The following features from the original app have been removed:

- Automatic pose detection and action recognition
- Role selection (attacker/defender)
- Real-time action feedback
- Complex pose analysis algorithms
- Video upload functionality
- TensorFlow.js dependencies

## 🏗️ New Architecture

- **Simplified UI**: Focus on capture and review
- **Server-side Processing**: All pose detection happens on the server
- **Manual Capture**: User controls when to capture images
- **Session Management**: Organize captures by training sessions
- **API-based**: Clean separation between client and server

## 📱 Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

This project is open source and available under the MIT License.
