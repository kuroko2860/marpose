import React, { useEffect, useRef, useState } from "react";
import * as posedetection from "@tensorflow-models/pose-detection";
import * as tf from "@tensorflow/tfjs";
import { trainingTypes, analyzePose, classifyAction, MIN_SCORE } from "./const";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";

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
  const [selectedPersonRoles, setSelectedPersonRoles] = useState({});
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [defenderSelected, setDefenderSelected] = useState(null);

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
      console.error("Error loading AI models:", error);
      setIsModelLoading(false);
      setError("Không thể tải mô hình AI. Vui lòng thử lại.");
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
      setError("Mô hình AI chưa được tải. Vui lòng thử lại.");
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

      // Analyze defender pose if training session is active
      let defenderAnalysis = null;
      if (currentSession && currentSession.trainingType) {
        defenderAnalysis = analyzeDefenderPose(
          poses,
          currentSession.trainingType
        );
      }

      // Add to captured images with analysis
      const newCapture = {
        id: Date.now(),
        image: imageData,
        timestamp: new Date().toISOString(),
        poses: poses,
        analysis: analysis,
        defenderAnalysis: defenderAnalysis,
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
    if (!defenderPose || !defenderPose.keypoints) return null;

    // Get training type details
    const trainingType = trainingTypes.find((t) => t.id === trainingTypeId);
    if (!trainingType) return null;

    // Classify actions for all poses
    const classifiedActions = poses.map((pose) => {
      if (pose.keypoints) {
        return classifyAction(pose.keypoints);
      }
      return { action: "unknown", confidence: 0 };
    });

    // Find attacker actions
    const attackerActions = classifiedActions.filter(
      (_, index) => roles[index] === "attacker"
    );

    // Analyze defender pose based on detected action
    const defenderActionClassification =
      classifiedActions[parseInt(defenderIndex)];
    const defenderAction = defenderActionClassification.action;

    const analysis = analyzePose(defenderPose.keypoints, defenderAction);

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

  // Process uploaded image with two-stage detection
  const processUploadedImage = async (file) => {
    if (!multiPoseDetector || !singlePoseDetector) {
      setError("Mô hình AI chưa được tải. Vui lòng thử lại.");
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

      // Analyze defender pose if training session is active
      let defenderAnalysis = null;
      if (currentSession && currentSession.trainingType) {
        defenderAnalysis = analyzeDefenderPose(
          poses,
          currentSession.trainingType
        );
      }

      // Create capture object
      const newCapture = {
        id: Date.now(),
        image: imageData,
        timestamp: new Date().toISOString(),
        poses: poses,
        analysis: analysis,
        defenderAnalysis: defenderAnalysis,
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
    isDetailView = false,
    selectedPersonRoles
  ) => {
    if (!poses || poses.length === 0) return;

    // Only draw skeletons if roles are assigned (not in role selection mode)
    // if (showRoleSelection) return;

    // Adjust line width and keypoint size based on view type
    const lineWidth = isDetailView ? 6 : 2;
    const keypointRadius = isDetailView ? 8 : 4;
    const labelFontSize = isDetailView ? "bold 20px Arial" : "bold 14px Arial";

    poses.forEach((pose, index) => {
      const keypoints = pose.keypoints || [];

      // Determine role and colors based on assigned roles
      let skeletonColor, keypointColor;

      if (selectedPersonRoles[index] === "defender") {
        // Green for defender
        skeletonColor = "#22c55e";
        keypointColor = "#16a34a";
      } else if (selectedPersonRoles[index] === "attacker") {
        // Red for attacker
        skeletonColor = "#ef4444";
        keypointColor = "#dc2626";
      } else {
        // Purple for unassigned roles
        skeletonColor = "#8b5cf6";
        keypointColor = "#7c3aed";
      }

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
        let label;
        if (selectedPersonRoles[index] === "defender") {
          label = "DEFENDER";
        } else if (selectedPersonRoles[index] === "attacker") {
          label = "ATTACKER";
        } else {
          label = "UNASSIGNED";
        }

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

  // Draw bounding boxes and person IDs
  const drawBoundingBoxes = (ctx, poses, canvasWidth, canvasHeight) => {
    if (!poses || poses.length === 0) return;

    poses.forEach((pose, index) => {
      if (!pose.bbox) return;

      const bbox = pose.bbox;
      const personId = index + 1;

      // Draw bounding box
      ctx.strokeStyle = "#3b82f6"; // Blue color
      ctx.lineWidth = 3;
      ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);

      // Draw person ID background
      const idText = `Person ${personId}`;
      ctx.font = "bold 16px Arial";

      // Use purple background for role selection mode
      const isSelected = defenderSelected === index;
      ctx.fillStyle = isSelected ? "#7c3aed" : "#8b5cf6"; // Purple background
      const textMetrics = ctx.measureText(idText);
      const textWidth = textMetrics.width + 16;
      const textHeight = 24;

      ctx.fillRect(bbox.x, bbox.y - textHeight, textWidth, textHeight);

      // Draw person ID text
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.fillText(idText, bbox.x + 8, bbox.y - 6);

      // Draw role if assigned
      if (selectedPersonRoles[index]) {
        const role = selectedPersonRoles[index];
        const roleText = role === "defender" ? "DEFENDER" : "ATTACKER";
        const roleColor = role === "defender" ? "#22c55e" : "#ef4444";

        ctx.fillStyle = roleColor;
        ctx.font = "bold 14px Arial";
        const roleMetrics = ctx.measureText(roleText);
        const roleWidth = roleMetrics.width + 12;
        const roleHeight = 20;

        ctx.fillRect(
          bbox.x + bbox.width - roleWidth,
          bbox.y - textHeight - roleHeight,
          roleWidth,
          roleHeight
        );

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(
          roleText,
          bbox.x + bbox.width - roleWidth / 2,
          bbox.y - textHeight - 6
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
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
                  Mô hình AI:{" "}
                  {multiPoseDetector && singlePoseDetector
                    ? "Đã Sẵn Sàng"
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

                      // Draw bounding boxes first
                      if (
                        selectedImageDetail.poses &&
                        selectedImageDetail.poses.length > 0
                      ) {
                        drawBoundingBoxes(
                          ctx,
                          selectedImageDetail.poses,
                          canvas.width,
                          canvas.height
                        );

                        // Only draw pose skeleton if not in role selection mode
                        if (!showRoleSelection) {
                          drawPoseSkeleton(
                            ctx,
                            selectedImageDetail.poses,
                            canvas.width,
                            canvas.height,
                            true, // Enable detail view mode
                            selectedPersonRoles
                          );
                        }
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
                  {/* Role Selection */}
                  {showRoleSelection &&
                    selectedImageDetail.poses &&
                    selectedImageDetail.poses.length > 0 && (
                      <div className="bg-gray-700 rounded-lg p-4 mb-4">
                        <h5 className="font-semibold text-white mb-3">
                          🛡️ Chọn Defender
                        </h5>
                        <div className="mb-3 p-2 bg-purple-500/20 border border-purple-500/50 rounded text-sm text-purple-400">
                          💜 Chọn người nào là Defender. Người còn lại sẽ tự
                          động là Attacker.
                        </div>
                        <div className="space-y-3">
                          {selectedImageDetail.poses.map((pose, index) => (
                            <div
                              key={index}
                              className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                                defenderSelected === index
                                  ? "border-green-500 bg-green-500/10"
                                  : "border-gray-600 hover:border-purple-500"
                              }`}
                              onClick={() => selectDefender(index)}
                            >
                              <div className="flex items-center space-x-2">
                                <div
                                  className={`w-4 h-4 rounded-full ${
                                    defenderSelected === index
                                      ? "bg-green-500"
                                      : "bg-purple-500"
                                  }`}
                                ></div>
                                <div className="text-sm text-gray-300">
                                  Person {index + 1}
                                </div>
                                {defenderSelected === index && (
                                  <div className="text-xs text-green-400 font-medium">
                                    ✅ Selected as Defender
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Defender Analysis */}
                  {selectedImageDetail.defenderAnalysis && (
                    <div className="bg-gray-700 rounded-lg p-4 mb-4">
                      <h5 className="font-semibold text-white mb-3">
                        🥋 Phân Tích Defender
                      </h5>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-300">
                            Loại huấn luyện:
                          </span>
                          <span className="text-sm text-blue-400 font-medium">
                            {selectedImageDetail.defenderAnalysis.trainingType}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-300">
                            Hành động Defender (AI):
                          </span>
                          <span className="text-sm text-green-400 font-medium">
                            {selectedImageDetail.defenderAnalysis
                              .defenderAction === "block"
                              ? "Chặn"
                              : selectedImageDetail.defenderAnalysis
                                  .defenderAction === "dodge"
                              ? "Né"
                              : selectedImageDetail.defenderAnalysis
                                  .defenderAction === "kick"
                              ? "Đá"
                              : selectedImageDetail.defenderAnalysis
                                  .defenderAction === "punch"
                              ? "Đấm"
                              : "Không xác định"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-300">
                            Độ tin cậy:
                          </span>
                          <span className="text-sm text-blue-400 font-medium">
                            {Math.round(
                              selectedImageDetail.defenderAnalysis
                                .defenderConfidence * 100
                            )}
                            %
                          </span>
                        </div>
                        {selectedImageDetail.defenderAnalysis.attackerActions &&
                          selectedImageDetail.defenderAnalysis.attackerActions
                            .length > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-300">
                                Hành động Attacker (AI):
                              </span>
                              <span className="text-sm text-red-400 font-medium">
                                {selectedImageDetail.defenderAnalysis.attackerActions
                                  .map((action) =>
                                    action.action === "kick"
                                      ? "Đá"
                                      : action.action === "punch"
                                      ? "Đấm"
                                      : action.action === "block"
                                      ? "Chặn"
                                      : action.action === "dodge"
                                      ? "Né"
                                      : "Không xác định"
                                  )
                                  .join(", ")}
                              </span>
                            </div>
                          )}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-300">
                            Điểm số:
                          </span>
                          <span
                            className={`text-sm font-medium ${
                              selectedImageDetail.defenderAnalysis.score >= 0.8
                                ? "text-green-400"
                                : selectedImageDetail.defenderAnalysis.score >=
                                  0.5
                                ? "text-yellow-400"
                                : "text-red-400"
                            }`}
                          >
                            {Math.round(
                              selectedImageDetail.defenderAnalysis.score * 100
                            )}
                            %
                          </span>
                        </div>
                        <div className="mt-3 p-3 bg-gray-600 rounded-lg">
                          <div className="text-sm text-white font-medium mb-2">
                            Phản hồi:
                          </div>
                          <div className="text-sm text-gray-300">
                            {selectedImageDetail.defenderAnalysis.feedback}
                          </div>
                        </div>
                        {selectedImageDetail.defenderAnalysis.details &&
                          selectedImageDetail.defenderAnalysis.details.length >
                            0 && (
                            <div className="mt-3">
                              <div className="text-sm text-white font-medium mb-2">
                                Chi tiết:
                              </div>
                              <ul className="space-y-1">
                                {selectedImageDetail.defenderAnalysis.details.map(
                                  (detail, index) => (
                                    <li
                                      key={index}
                                      className="text-sm text-gray-300 flex items-center"
                                    >
                                      <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                                      {detail}
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>
                          )}
                      </div>
                    </div>
                  )}

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
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
