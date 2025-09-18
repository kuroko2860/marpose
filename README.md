# 🥋 Fight Trainer AI

A real-time martial arts action analysis application that uses computer vision to detect and analyze fighting movements between two people (attacker and defender).

## ✨ Features

- **Real-time Pose Detection**: Uses MoveNet for accurate pose estimation
- **Skeleton Visualization**: Live skeleton overlay on webcam feed with color-coded roles
- **Action Recognition**: Automatically detects and captures:
  - 🦵 **Kicks** - High impact leg strikes
  - 👊 **Punches** - Quick hand strikes
  - 🛡️ **Blocks** - Defensive movements
  - 💨 **Dodges** - Evasive maneuvers
- **Smart Tracking**: SORT algorithm for consistent person tracking
- **Beautiful UI**: Modern, responsive design with Tailwind CSS
- **Action Gallery**: Captured moments with detailed popup views
- **Live Statistics**: Real-time action counting and analysis

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- Modern web browser with camera access
- WebGL support for TensorFlow.js

### Installation

1. Clone the repository

```bash
git clone <your-repo-url>
cd mart
```

2. Install dependencies

```bash
npm install
```

3. Start the development server

```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## 🎯 How It Works

1. **Camera Setup**: The app requests webcam access and initializes the AI models
2. **Pose Detection**: MoveNet analyzes each frame to detect human poses
3. **Person Tracking**: SORT algorithm tracks individuals across frames
4. **Role Assignment**: Automatically assigns "Defender" (blue) and "Attacker" (red) roles
5. **Action Analysis**: Monitors joint angles and distances to detect specific movements
6. **Capture & Store**: Automatically captures the best moments of each action type

## 🎨 UI Features

- **Dark Theme**: Professional dark interface with gradient backgrounds
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Real-time Feedback**: Live status indicators and action notifications
- **Interactive Gallery**: Click on captured actions to view full-size images
- **Statistics Dashboard**: Beautiful cards showing action counts and totals

## 🔧 Technical Stack

- **React 19** - Modern React with hooks
- **Vite** - Fast build tool and dev server
- **TensorFlow.js** - Machine learning in the browser
- **MoveNet** - Google's pose detection model
- **SORT** - Simple Online and Realtime Tracking
- **Tailwind CSS** - Utility-first CSS framework

## 📱 Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

This project is open source and available under the MIT License.
