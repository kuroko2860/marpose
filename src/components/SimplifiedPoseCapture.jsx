import React, { useEffect, useRef, useState } from "react";
import PoseApiService from "../services/poseApi";
import { convertToBinaryData } from "../utils/imageUtils";
import ConnectionStatus from "./ConnectionStatus";
import WebcamControls from "./WebcamControls";
import VideoFeed from "./VideoFeed";
import CapturedImages from "./CapturedImages";
import TrainingTypeModal from "./TrainingTypeModal";
import SimplifiedImageDetailModal from "./SimplifiedImageDetailModal";
import SessionControls from "./SessionControls";
import { drawPoseSkeleton, drawBoundingBoxes } from "../utils/drawingUtils";

export default function SimplifiedPoseCapture() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // State management
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImages, setCapturedImages] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [error, setError] = useState(null);
  const [showTrainingTypeModal, setShowTrainingTypeModal] = useState(false);
  const [selectedTrainingType, setSelectedTrainingType] = useState("");
  const [selectedImageDetail, setSelectedImageDetail] = useState(null);
  const [showImageDetailModal, setShowImageDetailModal] = useState(false);

  // API service states
  const [poseApiService] = useState(() => new PoseApiService());
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingInterval, setStreamingInterval] = useState(null);

  // Real-time pose data from WebSocket
  const [currentPoses, setCurrentPoses] = useState([]);
  const currentPosesRef = useRef([]);

  // Defender selection states
  const [defenderTrackId, setDefenderTrackId] = useState(null);
  const defenderTrackIdRef = useRef(null);

  // Image upload states
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);

  // Image detail modal states for uploaded images
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [selectedPersonRoles, setSelectedPersonRoles] = useState({});
  const [defenderSelected, setDefenderSelected] = useState(null);

  // Reconnect function
  const handleReconnect = () => {
    initializeApiService();
  };

  // Initialize API service connection
  const initializeApiService = async () => {
    try {
      // Connect to WebSocket
      poseApiService.connectWebSocket((data) => {
        handlePoseResult(data);
      });

      // Wait a bit for connection to establish
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check connection status
      const status = poseApiService.getConnectionStatus();
      setIsApiConnected(status.isConnected);
      console.log("Initial connection status:", status);

      // If webcam is already active, start streaming
      if (isWebcamActive && status.isConnected) {
        startFrameStreaming();
      }
    } catch (error) {
      console.error("Error initializing API service:", error);
      setError("Không thể kết nối đến API server. Vui lòng thử lại.");
      setIsApiConnected(false);
    }
  };

  // Initialize API service on component mount
  useEffect(() => {
    initializeApiService();

    // Cleanup on unmount
    return () => {
      if (streamingInterval) {
        clearInterval(streamingInterval);
      }
      poseApiService.disconnectWebSocket();
    };
  }, []);

  // Start streaming frames to WebSocket
  const startFrameStreaming = () => {
    if (streamingInterval) {
      clearInterval(streamingInterval);
    }

    console.log("Starting frame streaming...");
    const interval = setInterval(async () => {
      if (canvasRef.current && isApiConnected) {
        try {
          const canvas = canvasRef.current;
          const imageData = canvas.toDataURL("image/jpeg", 0.8);

          // Convert to binary and send via WebSocket
          const binaryData = await convertToBinaryData(imageData, 0.8);
          const result = await poseApiService.sendFrameForAnalysis(binaryData);
          console.log("Frame sent successfully:", result);
        } catch (error) {
          console.error("Error streaming frame:", error);
        }
      } else {
        console.log(
          "Cannot stream frame - canvas:",
          !!canvasRef.current,
          "API connected:",
          isApiConnected
        );
      }
    }, 200); // Send 5 frames per second

    setStreamingInterval(interval);
    setIsStreaming(true);
    console.log("Frame streaming started");
  };

  // Stop streaming frames
  const stopFrameStreaming = () => {
    if (streamingInterval) {
      clearInterval(streamingInterval);
      setStreamingInterval(null);
    }
    setIsStreaming(false);
  };

  // Monitor API connection and start streaming when available
  useEffect(() => {
    if (isApiConnected && isWebcamActive && !isStreaming) {
      startFrameStreaming();
    } else if (!isApiConnected && isStreaming) {
      stopFrameStreaming();
    }
  }, [isApiConnected, isWebcamActive, isStreaming]);

  // Periodic connection status check
  useEffect(() => {
    const connectionCheckInterval = setInterval(() => {
      const status = poseApiService.getConnectionStatus();
      console.log(
        "Connection check - Current state:",
        isApiConnected,
        "API status:",
        status.isConnected
      );
      if (status.isConnected !== isApiConnected) {
        console.log(
          "Connection status changed from",
          isApiConnected,
          "to",
          status.isConnected
        );
        setIsApiConnected(status.isConnected);
      }
    }, 1000); // Check every 1 second for faster updates

    return () => clearInterval(connectionCheckInterval);
  }, [isApiConnected, poseApiService]);

  // Handle pose results from WebSocket
  const handlePoseResult = (data) => {
    console.log("Received pose result:", data);
    if (data && data.success) {
      console.log(
        "Processing successful pose data with",
        data.poses?.length || 0,
        "poses"
      );
      // Transform API data format to frontend format
      const transformedPoses = (data.poses || []).map((pose) => ({
        ...pose,
        // Keep original API format for drawing functions
        keypoints_2d: pose.keypoints_2d,
        bbox: pose.bbox,
        // Add compatibility fields
        keypoints: pose.keypoints_2d
          ? pose.keypoints_2d.map(([x, y]) => ({ x, y, score: 1.0 }))
          : [],
        score: 1.0, // Assume high confidence for API data
        track_id: pose.track_id,
      }));

      // Update real-time poses for webcam canvas
      setCurrentPoses(transformedPoses);
      currentPosesRef.current = transformedPoses;
    } else {
      console.log("Received unsuccessful pose data:", data);
    }
  };

  // Draw video to canvas with real-time pose overlay
  const drawVideoToCanvas = () => {
    if (videoRef.current && canvasRef.current && isWebcamActive) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      // Draw video frame to canvas (dimensions already set during initialization)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Draw real-time pose data if available
      const posesToDraw = currentPosesRef.current;
      if (posesToDraw && posesToDraw.length > 0) {
        // Draw bounding boxes (use null for default colors when no defender selected)
        drawBoundingBoxes(
          ctx,
          posesToDraw,
          canvas.width,
          canvas.height,
          defenderTrackIdRef.current
        );

        // Draw skeleton (use null for default colors when no defender selected)
        drawPoseSkeleton(
          ctx,
          posesToDraw,
          canvas.width,
          canvas.height,
          false,
          defenderTrackIdRef.current
        );
      }

      // Continue drawing
      requestAnimationFrame(drawVideoToCanvas);
    }
  };

  // Start drawing when webcam becomes active
  useEffect(() => {
    if (isWebcamActive) {
      drawVideoToCanvas();
    }
  }, [isWebcamActive]);

  // Start webcam
  const startWebcam = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Small delay to ensure DOM is ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check if refs are available
      if (!videoRef.current || !canvasRef.current) {
        console.error("Video or canvas ref is null");
        console.log("Video ref:", videoRef.current);
        console.log("Canvas ref:", canvasRef.current);
        setError("Các thành phần camera chưa sẵn sàng. Vui lòng thử lại.");
        setIsLoading(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640, min: 320, max: 1280 },
          height: { ideal: 480, min: 240, max: 720 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: "user",
        },
        audio: false,
      });

      const video = videoRef.current;
      const canvas = canvasRef.current;

      video.srcObject = stream;

      // Wait for video metadata to load
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
          video
            .play()
            .then(() => {
              // Set canvas dimensions to match video
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              resolve(video);
            })
            .catch((err) => {
              reject(err);
              console.log(err);
            });
        };
      });

      setIsWebcamActive(true);
      setIsLoading(false);

      // Start streaming frames to WebSocket if connected
      if (isApiConnected) {
        startFrameStreaming();
      }
    } catch (error) {
      console.error("Error starting webcam:", error);
      setError(
        "Không thể truy cập camera. Vui lòng kiểm tra quyền và thử lại."
      );
      setIsLoading(false);
    }
  };

  // Stop webcam
  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    // Stop frame streaming
    stopFrameStreaming();

    // Clear current poses
    setCurrentPoses([]);
    currentPosesRef.current = [];

    setIsWebcamActive(false);
  };

  // Manual capture
  const captureImage = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const imageData = canvas.toDataURL("image/jpeg", 0.8);

    const capturedImage = {
      id: Date.now(),
      image: imageData,
      timestamp: Date.now(),
      source: "manual",
      poses: currentPosesRef.current,
      trainingTypeId: selectedTrainingType,
    };

    setCapturedImages((prev) => [...prev, capturedImage]);
    setIsCapturing(true);
    setTimeout(() => setIsCapturing(false), 1000);
  };

  // Capture webcam frame with overlays
  const captureWebcamFrame = () => {
    if (!videoRef.current || !canvasRef.current) {
      return null;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw video frame
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    // Draw current poses with overlays
    if (currentPosesRef.current && currentPosesRef.current.length > 0) {
      // Draw bounding boxes
      drawBoundingBoxes(
        ctx,
        currentPosesRef.current,
        canvas.width,
        canvas.height,
        defenderTrackIdRef.current
      );

      // Draw skeleton
      drawPoseSkeleton(
        ctx,
        currentPosesRef.current,
        canvas.width,
        canvas.height,
        false,
        defenderTrackIdRef.current
      );
    }

    // Return the canvas data as base64
    return canvas.toDataURL("image/jpeg", 0.8);
  };

  // Handle key frame captured
  const handleKeyFrameCaptured = (keyFrame) => {
    const capturedImage = {
      id: keyFrame.id,
      image: keyFrame.image,
      timestamp: keyFrame.timestamp,
      source: "auto",
      poses: [keyFrame.pose],
      trainingTypeId: keyFrame.trainingTypeId,
      motionSequence: keyFrame.motionSequence,
      detection: keyFrame.detection,
    };

    setCapturedImages((prev) => [...prev, capturedImage]);
  };

  // Start training session
  const startTrainingSession = () => {
    if (!selectedTrainingType) {
      setShowTrainingTypeModal(true);
      return;
    }

    const session = {
      id: Date.now(),
      trainingTypeId: selectedTrainingType,
      startTime: Date.now(),
    };

    setCurrentSession(session);

    // No immediate defender selection - just start training
  };

  // End training session - reset all states
  const endTrainingSession = () => {
    // Session states
    setCurrentSession(null);
    setSelectedTrainingType("");
    setDefenderTrackId(null);
    defenderTrackIdRef.current = null;
    setShowDefenderSelection(false);
    setCapturedImages([]);
    setError(null);

    // Webcam states
    setIsWebcamActive(false);
    setIsLoading(false);
    setIsCapturing(false);
    setIsStreaming(false);
    if (streamingInterval) {
      clearInterval(streamingInterval);
      setStreamingInterval(null);
    }

    // Pose states
    setCurrentPoses([]);
    currentPosesRef.current = [];

    // Image detail states
    setSelectedImageDetail(null);
    setShowImageDetailModal(false);
    setShowRoleSelection(false);
    setSelectedPersonRoles({});
    setDefenderSelected(null);

    // Upload states
    setIsProcessingUpload(false);
  };

  // Handle training type selection
  const handleTrainingTypeSelection = (trainingTypeId) => {
    setSelectedTrainingType(trainingTypeId);
    setShowTrainingTypeModal(false);
    startTrainingSession();
  };

  // Show image detail
  const showImageDetail = (image) => {
    setSelectedImageDetail(image);
    setShowImageDetailModal(true);

    // For both captured and uploaded images, show role selection first
    setSelectedPersonRoles({}); // Reset role selection
    setShowRoleSelection(true); // Show role selection initially
    setDefenderSelected(null); // Reset defender selection
  };

  // Close image detail
  const closeImageDetail = () => {
    setShowImageDetailModal(false);
    setSelectedImageDetail(null);
    setSelectedPersonRoles({});
    setShowRoleSelection(false);
    setDefenderSelected(null);
  };

  // Process uploaded image using HTTP API
  const processUploadedImage = async (file) => {
    if (!isApiConnected) {
      setError("API server chưa được kết nối. Vui lòng thử lại.");
      return;
    }

    try {
      setIsProcessingUpload(true);
      setError(null);

      // Convert file to data URL for display
      const imageData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Create capture object
      const newCapture = {
        id: Date.now(),
        image: imageData,
        timestamp: new Date().toISOString(),
        poses: [],
        analysis: null,
        defenderAnalysis: null,
        sessionId: currentSession?.id,
        trainingTypeId: selectedTrainingType || "1", // Link to current training type
        source: "upload",
        isProcessing: true,
      };

      // Add to captured images
      setCapturedImages((prev) => [...prev, newCapture]);

      // Send to API for analysis
      try {
        const result = await poseApiService.analyzeImage(file);

        if (result.success) {
          // Transform API data format to frontend format
          const transformedPoses = (result.poses || []).map((pose) => ({
            ...pose,
            // Keep original API format for drawing functions
            keypoints_2d: pose.keypoints_2d,
            bbox: pose.bbox,
            // Add compatibility fields
            keypoints: pose.keypoints_2d
              ? pose.keypoints_2d.map(([x, y]) => ({ x, y, score: 1.0 }))
              : [],
            score: 1.0, // Assume high confidence for API data
            track_id: pose.track_id,
          }));

          // Create analysis data
          const analysis = {
            total_poses: transformedPoses.length,
            confidence: transformedPoses.length > 0 ? 1.0 : 0,
            detection_time: "Server Processing",
            model: "Server AI Model",
            detection_method: "Server-side Pose Detection",
          };

          // Update the capture with server analysis
          setCapturedImages((prev) => {
            const updated = [...prev];
            const lastCapture = updated[updated.length - 1];
            if (lastCapture && lastCapture.id === newCapture.id) {
              lastCapture.poses = transformedPoses;
              lastCapture.analysis = analysis;
              lastCapture.defenderAnalysis = null; // Will be calculated when roles are assigned
              lastCapture.isProcessing = false;
              lastCapture.serverAnalysis = result; // Store original API response
            }
            return updated;
          });
        } else {
          throw new Error(result.message || "Analysis failed");
        }
      } catch (analysisError) {
        console.error("Analysis error:", analysisError);
        setError(`Lỗi phân tích: ${analysisError.message}`);

        // Mark capture as failed
        setCapturedImages((prev) => {
          const updated = [...prev];
          const lastCapture = updated[updated.length - 1];
          if (lastCapture && lastCapture.id === newCapture.id) {
            lastCapture.isProcessing = false;
            lastCapture.error = analysisError.message;
          }
          return updated;
        });
      }

      setIsProcessingUpload(false);
    } catch (error) {
      console.error("Error processing uploaded image:", error);
      setError("Lỗi khi xử lý ảnh. Vui lòng thử lại.");
      setIsProcessingUpload(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith("image/")) {
      processUploadedImage(file);
    } else {
      setError("Vui lòng chọn file ảnh hợp lệ.");
    }
  };

  // Handle defender selection for both captured and uploaded images
  const selectDefender = (defenderTrackId) => {
    if (!selectedImageDetail || !selectedImageDetail.poses) return;

    setDefenderSelected(defenderTrackId);

    // Assign roles: selected person is defender, others are attackers
    const roles = {};
    selectedImageDetail.poses.forEach((pose) => {
      roles[pose.track_id] =
        pose.track_id === defenderTrackId ? "defender" : "attacker";
    });

    setSelectedPersonRoles(roles);

    // Close role selection after a short delay
    setTimeout(() => {
      setShowRoleSelection(false);
    }, 500);
  };

  // Clear all captured/uploaded images
  const clearAllImages = () => {
    setCapturedImages([]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8">
          🥋 Hệ thống huấn luyện võ thuật
        </h1>

        {/* Connection Status */}
        <ConnectionStatus
          isApiConnected={isApiConnected}
          isStreaming={isStreaming}
          onReconnect={handleReconnect}
        />

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Controls */}
          <div className="space-y-6">
            {/* Webcam Controls */}
            <WebcamControls
              isWebcamActive={isWebcamActive}
              isLoading={isLoading}
              isCapturing={isCapturing}
              isApiConnected={isApiConnected}
              isProcessingUpload={isProcessingUpload}
              onStartWebcam={startWebcam}
              onStopWebcam={stopWebcam}
              onCaptureImage={captureImage}
              onFileUpload={handleFileUpload}
            />

            {/* Session Controls */}
            <SessionControls
              currentSession={currentSession}
              onShowTrainingTypeSelection={() => setShowTrainingTypeModal(true)}
              onResetSession={endTrainingSession}
            />
          </div>

          {/* Center Column - Video Feed */}
          <div className="space-y-6">
            <VideoFeed
              videoRef={videoRef}
              canvasRef={canvasRef}
              isWebcamActive={isWebcamActive}
              isStreaming={isStreaming}
              currentPoses={currentPoses}
            />
          </div>

          {/* Right Column - Captured Images */}
          <div className="space-y-6">
            {/* Clear Images Button */}
            {capturedImages.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={clearAllImages}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center space-x-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  <span>Xóa tất cả ảnh</span>
                </button>
              </div>
            )}

            <CapturedImages
              capturedImages={capturedImages}
              onImageClick={showImageDetail}
            />
          </div>
        </div>

        {/* Training Type Modal */}
        <TrainingTypeModal
          isOpen={showTrainingTypeModal}
          onClose={() => {
            setShowTrainingTypeModal(false);
            // Reset session if no training type was selected
            if (!selectedTrainingType) {
              endTrainingSession();
            }
          }}
          onSelectTrainingType={handleTrainingTypeSelection}
        />

        {/* Image Detail Modal */}
        <SimplifiedImageDetailModal
          isOpen={showImageDetailModal}
          onClose={closeImageDetail}
          selectedImageDetail={selectedImageDetail}
          onDrawPoseSkeleton={drawPoseSkeleton}
          onDrawBoundingBoxes={drawBoundingBoxes}
          showRoleSelection={showRoleSelection}
          defenderSelected={defenderSelected}
          selectedPersonRoles={selectedPersonRoles}
          onSelectDefender={selectDefender}
        />
      </div>
    </div>
  );
}
