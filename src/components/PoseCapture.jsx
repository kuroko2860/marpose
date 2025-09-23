import React, { useEffect, useRef, useState } from "react";
import { trainingTypes, analyzePose, classifyAction } from "../config/const";
import PoseApiService from "../services/poseApi";
import { convertToBinaryData } from "../utils/imageUtils";
import ConnectionStatus from "./ConnectionStatus";
import WebcamControls from "./WebcamControls";
import VideoFeed from "./VideoFeed";
import CapturedImages from "./CapturedImages";
import TrainingTypeModal from "./TrainingTypeModal";
import ImageDetailModal from "./ImageDetailModal";
import SessionControls from "./SessionControls";
import KeyFrameExtractor from "./KeyFrameExtractor";
import { drawPoseSkeleton, drawBoundingBoxes } from "../utils/drawingUtils";

export default function PoseCapture() {
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
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [selectedPersonRoles, setSelectedPersonRoles] = useState({});
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [defenderSelected, setDefenderSelected] = useState(null);

  // API service states
  const [poseApiService] = useState(() => new PoseApiService());
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingInterval, setStreamingInterval] = useState(null);

  // Real-time pose data from WebSocket
  const [currentPoses, setCurrentPoses] = useState([]);
  const currentPosesRef = useRef([]);

  // Key frame extraction states
  const [extractedKeyFrames, setExtractedKeyFrames] = useState([]);
  const [sessionAnalysis, setSessionAnalysis] = useState(null);

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

      // If webcam is already active, start streaming
      if (isWebcamActive && status.isConnected) {
        startFrameStreaming();
      }
    } catch (error) {
      console.error("Error initializing API service:", error);
      setError("Không thể kết nối đến API server. Vui lòng thử lại.");
    }
  };

  // Capture raw video frame without pose overlays
  const captureRawVideoFrame = () => {
    if (!videoRef.current) {
      return null;
    }

    try {
      // Create a temporary canvas for raw video capture
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");

      if (!tempCtx) {
        return null;
      }

      // Set canvas dimensions to match video
      tempCanvas.width = videoRef.current.videoWidth;
      tempCanvas.height = videoRef.current.videoHeight;

      // Draw only the video frame (no pose overlays)
      tempCtx.drawImage(
        videoRef.current,
        0,
        0,
        tempCanvas.width,
        tempCanvas.height
      );

      // Convert to data URL
      const imageData = tempCanvas.toDataURL("image/jpeg", 0.8);

      return imageData;
    } catch (error) {
      return null;
    }
  };

  // Handle key frame capture
  const handleKeyFrameCaptured = (keyFrame) => {
    setExtractedKeyFrames((prev) => [...prev.slice(-9), keyFrame]); // Keep last 10

    // Capture raw video frame (without pose overlays)
    const imageData = captureRawVideoFrame();

    // Add to captured images for display
    const capturedImage = {
      id: keyFrame.id,
      image: imageData,
      timestamp: new Date(keyFrame.timestamp).toISOString(),
      poses: [keyFrame.pose],
      analysis: {
        total_poses: 1,
        confidence: keyFrame.stabilityScore,
        detection_time: "Real-time",
        model: "Stability Detection",
        detection_method: "Key Frame Extraction",
        stabilityScore: keyFrame.stabilityScore,
        frameType: keyFrame.type,
      },
      defenderAnalysis: null,
      sessionId: currentSession?.id,
      source: "keyframe",
      isProcessing: false,
      isKeyFrame: true,
      keyFrameType: keyFrame.type,
    };

    setCapturedImages((prev) => [...prev, capturedImage]);
  };

  // Handle session analysis completion
  const handleSessionAnalysisComplete = (analysis) => {
    setSessionAnalysis(analysis);
    console.log("Training session analysis:", analysis);
  };

  const handlePoseResult = (data) => {
    if (data && data.success) {
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

      // Create analysis data
      const analysis = {
        total_poses: transformedPoses.length,
        confidence: transformedPoses.length > 0 ? 1.0 : 0, // API data assumed high confidence
        detection_time: "Server Processing",
        model: "Server AI Model",
        detection_method: "Server-side Pose Detection",
      };

      // Update the latest capture with server analysis
      setCapturedImages((prev) => {
        const updated = [...prev];
        const lastCapture = updated[updated.length - 1];
        if (lastCapture && !lastCapture.serverAnalysis) {
          lastCapture.poses = transformedPoses;
          lastCapture.analysis = analysis;
          lastCapture.defenderAnalysis = null; // Will be calculated when roles are assigned
          lastCapture.isProcessing = false;
          lastCapture.serverAnalysis = data; // Store original API response
        }
        return updated;
      });
    }
  };

  // Initialize webcam
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

  // Start streaming frames to WebSocket
  const startFrameStreaming = () => {
    if (streamingInterval) {
      clearInterval(streamingInterval);
    }

    const interval = setInterval(async () => {
      if (canvasRef.current && isApiConnected) {
        try {
          const canvas = canvasRef.current;
          const imageData = canvas.toDataURL("image/jpeg", 0.8);

          // Convert to binary and send via WebSocket
          const binaryData = await convertToBinaryData(imageData, 0.8);
          await poseApiService.sendFrameForAnalysis(binaryData);
        } catch (error) {
          console.error("Error streaming frame:", error);
        }
      }
    }, 200); // Send 10 frames per second

    setStreamingInterval(interval);
    setIsStreaming(true);
  };

  // Stop streaming frames
  const stopFrameStreaming = () => {
    if (streamingInterval) {
      clearInterval(streamingInterval);
      setStreamingInterval(null);
    }
    setIsStreaming(false);
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

  // Capture image and send to API for analysis
  const captureImage = async () => {
    if (!isWebcamActive || isCapturing) return;

    if (!isApiConnected) {
      setError("API server chưa được kết nối. Vui lòng thử lại.");
      return;
    }

    try {
      setIsCapturing(true);
      setError(null);

      // Capture raw video frame (without pose overlays)
      const imageData = captureRawVideoFrame();

      if (!imageData) {
        setError("Không thể chụp ảnh từ video. Vui lòng thử lại.");
        setIsCapturing(false);
        return;
      }

      // Create capture object
      const newCapture = {
        id: Date.now(),
        image: imageData,
        timestamp: new Date().toISOString(),
        poses: [],
        analysis: null,
        defenderAnalysis: null,
        sessionId: currentSession?.id,
        source: "camera",
        isProcessing: true,
      };

      // Add to captured images immediately
      setCapturedImages((prev) => [...prev, newCapture]);

      // Send to API for analysis
      try {
        const binaryData = await convertToBinaryData(imageData, 0.8);
        const result = await poseApiService.analyzeImage(binaryData);

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

      setIsCapturing(false);
    } catch (error) {
      console.error("Error capturing image:", error);
      setError("Lỗi khi chụp ảnh. Vui lòng thử lại.");
      setIsCapturing(false);
    }
  };

  // Show training type selection modal
  const showTrainingTypeSelection = () => {
    setShowTrainingTypeModal(true);
  };

  // Start new training session with selected type
  const startTrainingSession = (trainingType) => {
    const sessionId = `session_${Date.now()}`;
    const selectedType = trainingTypes.find((type) => type.id === trainingType);
    const newSession = {
      id: sessionId,
      startTime: new Date().toISOString(),
      name: `${selectedType.name} - ${new Date().toLocaleDateString()}`,
      type: trainingType,
      typeName: selectedType.name,
    };
    setCurrentSession(newSession);
    setCapturedImages([]);
    setError(null);
    setShowTrainingTypeModal(false);
    setSelectedTrainingType(trainingType);
  };

  // Reset current session
  const resetSession = () => {
    setCurrentSession(null);
    setCapturedImages([]);
    setError(null);
    setSelectedTrainingType("");
  };

  // Show image detail modal
  const showImageDetail = (capture) => {
    setSelectedImageDetail(capture);
    setShowImageDetailModal(true);
    setImageZoom(1); // Reset zoom when opening modal
    setSelectedPersonRoles({}); // Reset role selection
    setShowRoleSelection(true); // Show role selection initially
    setDefenderSelected(null); // Reset defender selection
  };

  // Close image detail modal
  const closeImageDetail = () => {
    setShowImageDetailModal(false);
    setSelectedImageDetail(null);
    setSelectedPersonRoles({});
    setShowRoleSelection(false);
    setDefenderSelected(null);
  };

  // Handle defender selection
  const selectDefender = (defenderIndex) => {
    if (!selectedImageDetail || !selectedImageDetail.poses) return;

    setDefenderSelected(defenderIndex);

    // Assign roles: selected person is defender, others are attackers
    const roles = {};
    selectedImageDetail.poses.forEach((_, index) => {
      roles[index] = index === defenderIndex ? "defender" : "attacker";
    });

    setSelectedPersonRoles(roles);

    // Close role selection after a short delay
    setTimeout(() => {
      setShowRoleSelection(false);
      redrawCanvas(false, roles);

      // Always analyze defender pose and classify actions
      const defenderAnalysis = analyzeDefenderPose(
        selectedImageDetail.poses,
        currentSession?.trainingType || "1", // Default to first training type if no session
        roles // Pass the roles directly
      );
      if (defenderAnalysis) {
        // Update the selected image detail with defender analysis
        setSelectedImageDetail((prev) => ({
          ...prev,
          defenderAnalysis: defenderAnalysis,
        }));
      }
    }, 500);
  };

  // Analyze defender pose and classify all actions
  const analyzeDefenderPose = (
    poses,
    trainingTypeId,
    roles = selectedPersonRoles
  ) => {
    if (!poses || poses.length === 0) return null;

    // Find the defender pose
    const defenderIndex = Object.keys(roles).find(
      (index) => roles[index] === "defender"
    );

    if (defenderIndex === undefined) return null;

    const defenderPose = poses[parseInt(defenderIndex)];
    if (!defenderPose) return null;

    // Get keypoints in the format expected by analyzePose function
    let keypoints;
    if (defenderPose.keypoints_2d) {
      // API format: convert [x, y] to {x, y, score}
      keypoints = defenderPose.keypoints_2d.map(([x, y]) => ({
        x,
        y,
        score: 1.0,
      }));
    } else if (defenderPose.keypoints) {
      // Old format: already in {x, y, score} format
      keypoints = defenderPose.keypoints;
    } else {
      return null;
    }

    // Get training type details
    const trainingType = trainingTypes.find((t) => t.id === trainingTypeId);
    if (!trainingType) return null;

    // Classify actions for all poses
    const classifiedActions = poses.map((pose) => {
      let poseKeypoints;
      if (pose.keypoints_2d) {
        poseKeypoints = pose.keypoints_2d.map(([x, y]) => ({
          x,
          y,
          score: 1.0,
        }));
      } else if (pose.keypoints) {
        poseKeypoints = pose.keypoints;
      } else {
        return { action: "unknown", confidence: 0 };
      }

      return classifyAction(poseKeypoints);
    });

    // Find attacker actions
    const attackerActions = classifiedActions.filter(
      (_, index) => roles[index] === "attacker"
    );

    // Analyze defender pose based on detected action
    const defenderActionClassification =
      classifiedActions[parseInt(defenderIndex)];
    const defenderAction = defenderActionClassification.action;

    const analysis = analyzePose(keypoints, defenderAction);

    return {
      ...analysis,
      trainingType: trainingType.name,
      defenderAction: defenderAction,
      attackerActions: attackerActions,
      allClassifiedActions: classifiedActions,
      defenderConfidence: defenderActionClassification.confidence,
    };
  };

  // Redraw canvas when roles change
  const redrawCanvas = (showRoleSelection, roles) => {
    if (!selectedImageDetail) return;

    const canvas = document.querySelector(".max-w-\\[700px\\]");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw image
      ctx.drawImage(img, 0, 0);

      // Draw bounding boxes and skeletons
      if (selectedImageDetail.poses && selectedImageDetail.poses.length > 0) {
        drawBoundingBoxes(
          ctx,
          selectedImageDetail.poses,
          canvas.width,
          canvas.height
        );
        // Only draw skeletons if not in role selection mode
        if (!showRoleSelection) {
          drawPoseSkeleton(
            ctx,
            selectedImageDetail.poses,
            canvas.width,
            canvas.height,
            true,
            roles
          );
        }
      }
    };

    img.src = selectedImageDetail.image;
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
        // Draw bounding boxes
        drawBoundingBoxes(ctx, posesToDraw, canvas.width, canvas.height);

        // Draw skeleton (without role colors for real-time view)
        drawPoseSkeleton(
          ctx,
          posesToDraw,
          canvas.width,
          canvas.height,
          false,
          {}
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
      if (status.isConnected !== isApiConnected) {
        setIsApiConnected(status.isConnected);
      }
    }, 2000); // Check every 2 seconds

    return () => clearInterval(connectionCheckInterval);
  }, [isApiConnected, poseApiService]);

  // Update canvas zoom when zoom level changes
  useEffect(() => {
    if (showImageDetailModal && selectedImageDetail) {
      const canvas = document.querySelector(".max-w-none.transition-transform");
      if (canvas) {
        canvas.style.transform = `scale(${imageZoom})`;
      }
    }
  }, [imageZoom, showImageDetailModal, selectedImageDetail]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && showImageDetailModal) {
        closeImageDetail();
      }
    };

    if (showImageDetailModal) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [showImageDetailModal]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Status Indicators */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <h1 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-400 to-red-400 bg-clip-text text-transparent py-2">
            📸 Phân tích tư thế võ thuật bằng AI
          </h1>
          <ConnectionStatus
            isApiConnected={isApiConnected}
            isStreaming={isStreaming}
            onReconnect={initializeApiService}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6">
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-red-400">
                <span>⚠️</span>
                <span className="font-medium">{error}</span>
              </div>
            </div>
          </div>
        )}

        {/* Webcam Controls */}
        <div className="mb-8">
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
          <div className="mt-4">
            <SessionControls
              currentSession={currentSession}
              onShowTrainingTypeSelection={showTrainingTypeSelection}
              onResetSession={resetSession}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Video Feed */}
          <VideoFeed
            isWebcamActive={isWebcamActive}
            isStreaming={isStreaming}
            videoRef={videoRef}
            canvasRef={canvasRef}
            currentPoses={currentPoses}
          />

          {/* Captured Images */}
          <CapturedImages
            capturedImages={capturedImages}
            onImageClick={showImageDetail}
          />
        </div>
      </div>

      {/* Training Type Selection Modal */}
      <TrainingTypeModal
        isOpen={showTrainingTypeModal}
        onClose={() => setShowTrainingTypeModal(false)}
        onSelectTrainingType={startTrainingSession}
      />

      {/* Image Detail Modal */}
      <ImageDetailModal
        isOpen={showImageDetailModal}
        selectedImageDetail={selectedImageDetail}
        showRoleSelection={showRoleSelection}
        defenderSelected={defenderSelected}
        selectedPersonRoles={selectedPersonRoles}
        imageZoom={imageZoom}
        onClose={closeImageDetail}
        onSelectDefender={selectDefender}
        onDrawPoseSkeleton={drawPoseSkeleton}
        onDrawBoundingBoxes={drawBoundingBoxes}
      />

      {/* Key Frame Extractor */}
      <KeyFrameExtractor
        currentPoses={currentPoses}
        isTrainingSession={!!currentSession}
        onKeyFrameCaptured={handleKeyFrameCaptured}
        onAnalysisComplete={handleSessionAnalysisComplete}
      />
    </div>
  );
}
