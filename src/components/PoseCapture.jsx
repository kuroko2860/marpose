import React, { useEffect, useRef, useState } from "react";
import * as posedetection from "@tensorflow-models/pose-detection";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";
import { trainingTypes, MIN_SCORE } from "./const";

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
  const [moveNetDetector, setMoveNetDetector] = useState(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [multiPoseDetector, setMultiPoseDetector] = useState(null);
  const [singlePoseDetector, setSinglePoseDetector] = useState(null);

  // Initialize both MoveNet models
  const initializeMoveNet = async () => {
    if (multiPoseDetector && singlePoseDetector) return;

    try {
      setIsModelLoading(true);
      console.log("Initializing MoveNet models...");

      // Initialize TensorFlow.js backend
      await tf.ready();
      try {
        await tf.setBackend("webgl");
        await tf.ready();
        console.log("Using WebGL backend");
      } catch (backendError) {
        console.log("WebGL not available, falling back to CPU");
        await tf.setBackend("cpu");
        await tf.ready();
      }

      // Initialize MultiPose detector for bounding box detection
      const multiPose = await posedetection.createDetector(
        posedetection.SupportedModels.MoveNet,
        {
          modelType: "MultiPose.Lightning",
          enableTracking: true,
          enableSmoothing: true,
          maxPoses: 2,
          flipHorizontal: false,
          minPoseConfidence: 0.1,
          minPartConfidence: 0.1,
          nmsRadius: 20,
          multiPoseMaxDimension: 256,
        }
      );

      // Initialize SinglePose detector for precise pose detection
      const singlePose = await posedetection.createDetector(
        posedetection.SupportedModels.MoveNet,
        {
          modelType: "SinglePose.Thunder",
          enableTracking: true,
          enableSmoothing: true,
          flipHorizontal: false,
          minPoseConfidence: 0.1,
          minPartConfidence: 0.1,
        }
      );

      setMultiPoseDetector(multiPose);
      setSinglePoseDetector(singlePose);
      setMoveNetDetector(multiPose); // Keep for backward compatibility
      setIsModelLoading(false);
      console.log("Both MoveNet models loaded successfully!");
    } catch (error) {
      console.error("Error loading MoveNet models:", error);
      setIsModelLoading(false);
      setError("Không thể tải mô hình MoveNet. Vui lòng thử lại.");
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
    setIsWebcamActive(false);
  };

  // Capture image and detect poses with two-stage detection
  const captureImage = async () => {
    if (!isWebcamActive || isCapturing) return;

    if (!multiPoseDetector || !singlePoseDetector) {
      setError("Mô hình MoveNet chưa được tải. Vui lòng thử lại.");
      return;
    }

    try {
      setIsCapturing(true);
      setError(null);

      // Capture image from canvas (which already has the video drawn on it)
      const canvas = canvasRef.current;
      const imageData = canvas.toDataURL("image/png");

      // Create image element for MoveNet processing
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageData;
      });

      // Use two-stage detection
      const poses = await detectPosesTwoStage(img);

      // Create analysis data
      const analysis = {
        total_poses: poses.length,
        confidence:
          poses.length > 0
            ? poses.reduce((sum, pose) => sum + pose.score, 0) / poses.length
            : 0,
        detection_time: "0.2s",
        model: "Two-Stage: MultiPose + SinglePose Thunder",
        detection_method: "Bbox Detection + Precise Pose",
        bbox_count: poses.filter((p) => p.bbox).length,
      };

      // Add to captured images with analysis
      const newCapture = {
        id: Date.now(),
        image: imageData,
        timestamp: new Date().toISOString(),
        poses: poses,
        analysis: analysis,
        sessionId: currentSession?.id,
        source: "camera",
      };

      setCapturedImages((prev) => [...prev, newCapture]);
      setIsCapturing(false);

      console.log("Two-stage poses detected from camera:", poses);
    } catch (error) {
      console.error("Error capturing image:", error);
      setError("Lỗi khi chụp ảnh hoặc xử lý tư thế. Vui lòng thử lại.");
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
  };

  // Close image detail modal
  const closeImageDetail = () => {
    setShowImageDetailModal(false);
    setSelectedImageDetail(null);
  };

  // Process uploaded image with two-stage detection
  const processUploadedImage = async (file) => {
    if (!multiPoseDetector || !singlePoseDetector) {
      setError("Mô hình MoveNet chưa được tải. Vui lòng thử lại.");
      return;
    }

    try {
      setIsProcessingUpload(true);
      setError(null);

      // Create image element
      const img = new Image();
      const imageUrl = URL.createObjectURL(file);

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      // Use two-stage detection
      const poses = await detectPosesTwoStage(img);
      console.log("Two-stage detection results:", poses);

      // Convert image to data URL
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      const imageData = canvas.toDataURL("image/png");

      // Create analysis data
      const analysis = {
        total_poses: poses.length,
        confidence:
          poses.length > 0
            ? poses.reduce((sum, pose) => sum + pose.score, 0) / poses.length
            : 0,
        detection_time: "0.2s",
        model: "Two-Stage: MultiPose + SinglePose Thunder",
        detection_method: "Bbox Detection + Precise Pose",
        bbox_count: poses.filter((p) => p.bbox).length,
      };

      // Create capture object
      const newCapture = {
        id: Date.now(),
        image: imageData,
        timestamp: new Date().toISOString(),
        poses: poses,
        analysis: analysis,
        sessionId: currentSession?.id,
        source: "upload",
      };

      // Add to captured images
      setCapturedImages((prev) => [...prev, newCapture]);

      // Clean up
      URL.revokeObjectURL(imageUrl);
      setIsProcessingUpload(false);

      console.log("Poses detected:", poses);
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

  // Two-stage detection: MultiPose for bbox, SinglePose for precise detection
  const detectPosesTwoStage = async (img) => {
    if (!multiPoseDetector || !singlePoseDetector) {
      throw new Error("Models not loaded");
    }

    // Stage 1: Detect bounding boxes using MultiPose
    const multiPoseResults = await multiPoseDetector.estimatePoses(img, {
      flipHorizontal: false,
      maxPoses: 2,
      scoreThreshold: 0.1,
      nmsRadius: 20,
      multiPoseMaxDimension: 256,
      enableSmoothing: true,
      enableTracking: true,
    });

    console.log("MultiPose bbox results:", multiPoseResults);

    if (multiPoseResults.length === 0) {
      return [];
    }

    // Stage 2: Use SinglePose Thunder on each detected person
    const finalPoses = [];

    for (let i = 0; i < multiPoseResults.length; i++) {
      const bboxPose = multiPoseResults[i];

      // Calculate bounding box from keypoints
      const keypoints = bboxPose.keypoints;
      if (keypoints.length === 0) continue;

      // Find min/max coordinates
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      let validKeypoints = 0;

      keypoints.forEach((kp) => {
        if (kp.score > 0.1) {
          minX = Math.min(minX, kp.x);
          minY = Math.min(minY, kp.y);
          maxX = Math.max(maxX, kp.x);
          maxY = Math.max(maxY, kp.y);
          validKeypoints++;
        }
      });

      if (validKeypoints < 3) continue; // Need at least 3 valid keypoints

      // Add padding to bounding box
      const padding = 70;
      const bbox = {
        x: Math.max(0, minX - padding),
        y: Math.max(0, minY - padding),
        width: Math.min(
          img.naturalWidth - (minX - padding),
          maxX - minX + 2 * padding
        ),
        height: Math.min(
          img.naturalHeight - (minY - padding),
          maxY - minY + 2 * padding
        ),
      };

      // Crop image to bounding box
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = bbox.width;
      canvas.height = bbox.height;

      ctx.drawImage(
        img,
        bbox.x,
        bbox.y,
        bbox.width,
        bbox.height,
        0,
        0,
        bbox.width,
        bbox.height
      );

      // Stage 2: Detect precise pose using SinglePose Thunder
      const singlePoseResults = await singlePoseDetector.estimatePoses(canvas, {
        flipHorizontal: false,
        scoreThreshold: 0.1,
        enableSmoothing: true,
        enableTracking: true,
      });

      if (singlePoseResults.length > 0) {
        const precisePose = singlePoseResults[0];

        // Transform coordinates back to original image space
        const transformedKeypoints = precisePose.keypoints.map((kp) => ({
          ...kp,
          x: kp.x + bbox.x,
          y: kp.y + bbox.y,
        }));

        finalPoses.push({
          ...precisePose,
          keypoints: transformedKeypoints,
          bbox: bbox,
          originalIndex: i,
        });
      }
    }

    return finalPoses;
  };

  // Draw pose skeleton on canvas
  const drawPoseSkeleton = (
    ctx,
    poses,
    canvasWidth,
    canvasHeight,
    isDetailView = false
  ) => {
    if (!poses || poses.length === 0) return;

    // Adjust line width and keypoint size based on view type
    const lineWidth = isDetailView ? 6 : 2;
    const keypointRadius = isDetailView ? 8 : 4;
    const labelFontSize = isDetailView ? "bold 20px Arial" : "bold 14px Arial";

    poses.forEach((pose, index) => {
      const keypoints = pose.keypoints || [];
      const isDefender = index === 0; // First pose is defender

      // Choose colors based on pose
      const skeletonColor = isDefender ? "#22c55e" : "#ef4444"; // Green for defender, Red for attacker
      const keypointColor = isDefender ? "#16a34a" : "#dc2626";

      // Draw skeleton connections (simplified MoveNet connections)
      const connections = [
        [0, 1],
        [0, 2],
        [1, 3],
        [2, 4], // Head
        [5, 6],
        [5, 7],
        [6, 8],
        [7, 9],
        [8, 10], // Arms
        [5, 11],
        [6, 12],
        [11, 12], // Torso
        [11, 13],
        [12, 14],
        [13, 15],
        [14, 16], // Legs
      ];

      // Draw skeleton with thicker lines for detail view
      ctx.strokeStyle = skeletonColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      connections.forEach(([startIdx, endIdx]) => {
        const startPoint = keypoints[startIdx];
        const endPoint = keypoints[endIdx];

        if (
          startPoint &&
          endPoint &&
          startPoint.score > MIN_SCORE &&
          endPoint.score > MIN_SCORE
        ) {
          ctx.beginPath();
          ctx.moveTo(startPoint.x, startPoint.y);
          ctx.lineTo(endPoint.x, endPoint.y);
          ctx.stroke();
        }
      });

      // Draw keypoints with larger size for detail view
      keypoints.forEach((keypoint) => {
        if (keypoint && keypoint.score > MIN_SCORE) {
          // Draw keypoint with gradient effect for detail view
          if (isDetailView) {
            const gradient = ctx.createRadialGradient(
              keypoint.x,
              keypoint.y,
              0,
              keypoint.x,
              keypoint.y,
              keypointRadius
            );
            gradient.addColorStop(0, keypointColor);
            gradient.addColorStop(0.7, keypointColor);
            gradient.addColorStop(1, "rgba(255, 255, 255, 0.3)");
            ctx.fillStyle = gradient;
          } else {
            ctx.fillStyle = keypointColor;
          }

          ctx.beginPath();
          ctx.arc(keypoint.x, keypoint.y, keypointRadius, 0, 2 * Math.PI);
          ctx.fill();

          // Add white border with thicker stroke for detail view
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = isDetailView ? 3 : 1;
          ctx.stroke();
        }
      });

      // Draw pose label with larger font for detail view
      if (keypoints[0] && keypoints[0].score > 0.3) {
        const label = isDefender ? "DEFENDER" : "ATTACKER";
        ctx.fillStyle = skeletonColor;
        ctx.font = labelFontSize;
        ctx.textAlign = "center";
        ctx.fillText(
          label,
          keypoints[0].x,
          keypoints[0].y - (isDetailView ? 30 : 20)
        );
      }
    });
  };

  // Draw video to canvas
  const drawVideoToCanvas = () => {
    if (videoRef.current && canvasRef.current && isWebcamActive) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      // Draw video frame to canvas (dimensions already set during initialization)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

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

  // Initialize MoveNet model on component mount
  useEffect(() => {
    initializeMoveNet();
  }, []);

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

  // Debug refs on mount
  useEffect(() => {
    console.log("Component mounted - Video ref:", videoRef.current);
    console.log("Component mounted - Canvas ref:", canvasRef.current);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      {/* <div className="bg-black/20 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-400 to-red-400 bg-clip-text text-transparent p-2">
            📸 Phân tích tư thế võ thuật bằng AI
          </h1>
           <p className="text-center text-gray-300 mt-2">
            Phân tích tư thế võ thuật bằng AI
          </p> 
        </div>
      </div> */}

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Status Indicators */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <h1 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-400 to-red-400 bg-clip-text text-transparent py-2">
            📸 Phân tích tư thế võ thuật bằng AI
          </h1>
          {/* MoveNet Model Status */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-4 border border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    moveNetDetector
                      ? "bg-green-500 animate-pulse"
                      : isModelLoading
                      ? "bg-yellow-500 animate-pulse"
                      : "bg-red-500"
                  }`}
                ></div>
                <span className="text-sm">
                  MoveNet Models:{" "}
                  {multiPoseDetector && singlePoseDetector
                    ? "MultiPose + SinglePose - Đã Sẵn Sàng"
                    : isModelLoading
                    ? "Đang Tải..."
                    : "Chưa Tải"}
                </span>
              </div>
              {!moveNetDetector && !isModelLoading && (
                <button
                  onClick={initializeMoveNet}
                  className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-sm transition-colors"
                >
                  Tải Lại
                </button>
              )}
            </div>
          </div>
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
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <span className="text-2xl mr-3">🎥</span>
              Điều Khiển Camera
            </h2>

            <div className="flex items-center space-x-4 mb-4">
              {!isWebcamActive ? (
                <button
                  onClick={startWebcam}
                  disabled={isLoading}
                  className="bg-green-500 hover:bg-green-600 disabled:bg-gray-500 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Đang khởi động...</span>
                    </>
                  ) : (
                    <>
                      <span>📹</span>
                      <span>Bật Camera</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={stopWebcam}
                  className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                  <span>⏹️</span>
                  <span>Dừng Camera</span>
                </button>
              )}

              {isWebcamActive && (
                <button
                  onClick={captureImage}
                  disabled={
                    isCapturing || !multiPoseDetector || !singlePoseDetector
                  }
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                  {isCapturing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Đang chụp...</span>
                    </>
                  ) : (
                    <>
                      <span>📸</span>
                      <span>Chụp Ảnh</span>
                    </>
                  )}
                </button>
              )}

              {/* Upload Image Button */}
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={
                    !multiPoseDetector ||
                    !singlePoseDetector ||
                    isProcessingUpload
                  }
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className={`${
                    !multiPoseDetector ||
                    !singlePoseDetector ||
                    isProcessingUpload
                      ? "bg-gray-500 cursor-not-allowed"
                      : "bg-purple-500 hover:bg-purple-600 cursor-pointer"
                  } text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2`}
                >
                  {isProcessingUpload ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Đang xử lý...</span>
                    </>
                  ) : isModelLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Đang tải mô hình...</span>
                    </>
                  ) : (
                    <>
                      <span>📁</span>
                      <span>Tải Ảnh Lên</span>
                    </>
                  )}
                </label>
              </div>
            </div>

            {/* Session Controls */}
            <div className="flex items-center space-x-4">
              {!currentSession ? (
                <button
                  onClick={showTrainingTypeSelection}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                  <span>🏁</span>
                  <span>Bắt Đầu Phiên Huấn Luyện</span>
                </button>
              ) : (
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-orange-400">
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                    <span className="text-sm">{currentSession.typeName}</span>
                  </div>
                  <button
                    onClick={resetSession}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Đặt Lại Phiên
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Video Feed */}
          <div>
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <span
                  className={`w-3 h-3 rounded-full mr-3 ${
                    isWebcamActive
                      ? "bg-green-500 animate-pulse"
                      : "bg-gray-500"
                  }`}
                ></span>
                Luồng Camera Trực Tiếp
              </h2>

              <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl h-96">
                {/* Always render video and canvas elements for refs */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  width={640}
                  height={480}
                  className="hidden"
                />
                <canvas
                  ref={canvasRef}
                  className={`w-full h-full object-cover ${
                    !isWebcamActive ? "hidden" : ""
                  }`}
                />

                {!isWebcamActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                    <div className="text-center">
                      <div className="text-6xl mb-4">📹</div>
                      <p className="text-gray-300 text-lg">
                        Nhấn "Bật Camera" để bắt đầu
                      </p>
                    </div>
                  </div>
                )}

                {/* Overlay Info */}
                {isWebcamActive && (
                  <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2">
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-green-400">
                          Camera Đang Hoạt Động
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            multiPoseDetector && singlePoseDetector
                              ? "bg-green-400"
                              : "bg-yellow-400"
                          }`}
                        ></div>
                        <span
                          className={
                            multiPoseDetector && singlePoseDetector
                              ? "text-green-400"
                              : "text-yellow-400"
                          }
                        >
                          {multiPoseDetector && singlePoseDetector
                            ? "Two-Stage Sẵn Sàng"
                            : "Đang Tải Models"}
                        </span>
                      </div>
                      {capturedImages.length > 0 && (
                        <div className="text-blue-400">
                          {capturedImages.length} ảnh đã chụp
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Captured Images */}
          <div>
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <span className="text-2xl mr-3">📸</span>
                Ảnh Đã Chụp
                {capturedImages.length > 0 && (
                  <span className="ml-3 bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm">
                    {capturedImages.length} đã chụp
                  </span>
                )}
              </h2>

              {capturedImages.length === 0 ? (
                <div className="flex items-center justify-center h-96 bg-gray-800 rounded-xl">
                  <div className="text-center">
                    <div className="text-6xl mb-4">📷</div>
                    <p className="text-gray-300 text-lg">
                      Chưa có ảnh nào được chụp
                    </p>
                    <p className="text-gray-400 text-sm mt-2">
                      Bật camera và nhấn "Chụp Ảnh"
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 max-h-96 overflow-y-auto">
                  {capturedImages.map((capture) => (
                    <div
                      key={capture.id}
                      className="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-blue-500 transition-colors cursor-pointer"
                      onClick={() => showImageDetail(capture)}
                    >
                      <div className="flex space-x-4">
                        <img
                          src={capture.image}
                          alt="Captured pose"
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                        <div className="flex-1">
                          <div className="text-sm text-gray-300 mb-2">
                            {new Date(capture.timestamp).toLocaleTimeString()}
                          </div>
                          <div className="text-sm text-blue-400 mb-1">
                            Tư thế phát hiện: {capture.poses?.length || 0}
                          </div>
                          {capture.analysis && (
                            <div className="text-xs text-gray-400 mb-1">
                              Độ tin cậy:{" "}
                              {Math.round(
                                (capture.analysis.confidence || 0) * 100
                              )}
                              %
                            </div>
                          )}
                          <div className="text-xs text-purple-400 mb-1">
                            {capture.source === "upload"
                              ? "📁 Tải lên"
                              : "📸 Camera"}
                            {capture.analysis?.model &&
                              ` - ${capture.analysis.model}`}
                          </div>
                          <div className="text-xs text-green-400">
                            Nhấn để xem chi tiết →
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Training Type Selection Modal */}
      {showTrainingTypeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-gray-700">
            <h3 className="text-xl font-bold mb-4 text-center text-white">
              🏆 Chọn Bài Huấn Luyện
            </h3>

            <div className="space-y-3 mb-6">
              {trainingTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => startTrainingSession(type.id)}
                  className="w-full p-4 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 hover:border-orange-500 transition-colors text-left"
                >
                  <div className="font-semibold text-white mb-1">
                    {type.name}
                  </div>
                  {/* <div className="text-sm text-gray-300">
                    {type.description}
                  </div> */}
                </button>
              ))}
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => setShowTrainingTypeModal(false)}
                className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Detail Modal */}
      {showImageDetailModal && selectedImageDetail && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50">
          <div className="h-full w-full flex flex-col">
            {/* Header */}
            <div className="bg-gray-800/95 backdrop-blur-sm border-b border-gray-700 p-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                📸 Chi Tiết Ảnh Chụp
              </h3>
              <button
                onClick={closeImageDetail}
                className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Đóng
              </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Image Section - Half Screen */}
              <div className="w-2/3 flex flex-col">
                <div className="flex items-center justify-between p-4 bg-gray-800/50 border-b border-gray-700">
                  <h4 className="text-lg font-semibold text-white">
                    Ảnh với Skeleton Tư Thế
                  </h4>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() =>
                        setImageZoom(Math.max(0.5, imageZoom - 0.25))
                      }
                      className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      -
                    </button>
                    <span className="text-sm text-gray-300 min-w-[60px] text-center">
                      {Math.round(imageZoom * 100)}%
                    </span>
                    <button
                      onClick={() =>
                        setImageZoom(Math.min(3, imageZoom + 0.25))
                      }
                      className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      +
                    </button>
                    <button
                      onClick={() => setImageZoom(1)}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <div className="flex-1 bg-black overflow-auto">
                  <img
                    src={selectedImageDetail.image}
                    alt="Captured pose with skeleton"
                    className="object-scale-down"
                    onLoad={(e) => {
                      // Draw pose skeleton on image load
                      const img = e.target;
                      const canvas = document.createElement("canvas");
                      const ctx = canvas.getContext("2d");

                      // Use original image dimensions for better quality
                      canvas.width = img.naturalWidth;
                      canvas.height = img.naturalHeight;

                      // Draw image
                      ctx.drawImage(img, 0, 0);

                      // Draw pose skeleton with detail view settings
                      if (
                        selectedImageDetail.poses &&
                        selectedImageDetail.poses.length > 0
                      ) {
                        drawPoseSkeleton(
                          ctx,
                          selectedImageDetail.poses,
                          canvas.width,
                          canvas.height,
                          true // Enable detail view mode
                        );
                      }

                      // Replace image with canvas
                      img.style.display = "none";
                      img.parentNode.appendChild(canvas);
                      canvas.className =
                        "max-w-[700px] transition-transform duration-200";
                      canvas.style.transform = `scale(${imageZoom})`;
                      canvas.style.transformOrigin = "top left";
                    }}
                  />
                </div>
              </div>

              {/* Analysis Section - Half Screen */}
              <div className="w-1/3 flex flex-col bg-gray-800/30">
                <div className="p-4 bg-gray-800/50 border-b border-gray-700">
                  <h4 className="text-lg font-semibold text-white">
                    Phân Tích & Phản Hồi
                  </h4>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {/* Basic Info */}
                  <div className="bg-gray-700 rounded-lg p-4 mb-4">
                    <h5 className="font-semibold text-white mb-2">
                      Thông Tin Cơ Bản
                    </h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-300">Thời gian:</span>
                        <span className="text-white">
                          {new Date(
                            selectedImageDetail.timestamp
                          ).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Số tư thế:</span>
                        <span className="text-white">
                          {selectedImageDetail.poses?.length || 0}
                        </span>
                      </div>
                      {selectedImageDetail.analysis && (
                        <div className="flex justify-between">
                          <span className="text-gray-300">Độ tin cậy:</span>
                          <span className="text-white">
                            {Math.round(
                              (selectedImageDetail.analysis.confidence || 0) *
                                100
                            )}
                            %
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pose Details */}
                  {selectedImageDetail.poses &&
                    selectedImageDetail.poses.length > 0 && (
                      <div className="bg-gray-700 rounded-lg p-4 mb-4">
                        <h5 className="font-semibold text-white mb-2">
                          Chi Tiết Tư Thế
                        </h5>
                        <div className="space-y-3">
                          {selectedImageDetail.poses.map((pose, index) => (
                            <div
                              key={index}
                              className="border-l-4 border-blue-500 pl-3"
                            >
                              <div className="text-sm text-blue-400 font-medium">
                                Tư thế {index + 1}{" "}
                                {index === 0 ? "(Defender)" : "(Attacker)"}
                              </div>
                              <div className="text-xs text-gray-300">
                                Điểm số: {Math.round((pose.score || 0) * 100)}%
                              </div>
                              <div className="text-xs text-gray-300">
                                Keypoints: {pose.keypoints?.length || 0}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Analysis */}
                  {selectedImageDetail.analysis && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h5 className="font-semibold text-white mb-2">
                        Phân Tích Chi Tiết
                      </h5>
                      <div className="space-y-2 text-sm">
                        {Object.entries(selectedImageDetail.analysis).map(
                          ([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-gray-300 capitalize">
                                {key}:
                              </span>
                              <span className="text-white">{value}</span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Feedback */}
                  <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-lg p-4 mt-4 border border-green-500/30">
                    <h5 className="font-semibold text-green-400 mb-2">
                      💡 Phản Hồi
                    </h5>
                    <p className="text-sm text-gray-300">
                      {selectedImageDetail.poses &&
                      selectedImageDetail.poses.length > 0
                        ? "Tư thế được phát hiện thành công! Hãy tiếp tục luyện tập để cải thiện kỹ thuật."
                        : "Không phát hiện được tư thế rõ ràng. Hãy đảm bảo bạn đang trong tầm nhìn của camera."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
