import React, { useEffect, useRef, useState } from "react";
import * as posedetection from "@tensorflow-models/pose-detection";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";
// Using MoveNet's built-in tracking instead of custom SORT
import { POSE_CONNECTIONS, KEYPOINT_NAMES } from "./const";
import { distance, angle, bboxFromKeypoints } from "./utils";
import { poseAnalyzer } from "./poseAnalyzer";

export default function FightTrainer() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [gallery, setGallery] = useState([]);
  const [counts, setCounts] = useState({
    kick: 0,
    punch: 0,
    block: 0,
    dodge: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [lastAction, setLastAction] = useState(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isTrainingActive, setIsTrainingActive] = useState(false);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState({
    attacker: null,
    defender: null,
  });
  const [availablePoses, setAvailablePoses] = useState([]);
  const [isVideoUploaded, setIsVideoUploaded] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [roleSelectionWarning, setRoleSelectionWarning] = useState("");
  const [modelLoaded, setModelLoaded] = useState(false);
  const [isVideoPaused, setIsVideoPaused] = useState(false);
  const [videoPausedForRoleSelection, setVideoPausedForRoleSelection] =
    useState(false);
  const [recommendations, setRecommendations] = useState([]);

  const detector = useRef(null);
  const defenderId = useRef(null);
  const attackerId = useRef(null);
  const baselineDefenderX = useRef(null);
  const videoTrack = useRef(null);

  // Cooldown for action detection to prevent duplicate captures
  const lastActionTime = useRef({
    kick: 0,
    punch: 0,
    block: 0,
    dodge: 0,
  });

  // Initialize model once at app startup
  const initializeModel = async () => {
    if (modelLoaded || detector.current) return;

    try {
      setIsLoading(true);

      // Initialize TensorFlow.js backend with optimizations
      await tf.ready();
      try {
        await tf.setBackend("webgl");
        await tf.ready();

        // Optimize WebGL backend for better performance
        tf.env().set("WEBGL_PACK", true);
        tf.env().set("WEBGL_FORCE_F16_TEXTURES", true);
        tf.env().set("WEBGL_DELETE_TEXTURE_THRESHOLD", 0);

        console.log("Using WebGL backend with optimizations");
      } catch (backendError) {
        console.log("WebGL not available, falling back to CPU");
        await tf.setBackend("cpu");
        await tf.ready();
      }

      // Initialize AI model with optimized settings for people detection
      detector.current = await posedetection.createDetector(
        posedetection.SupportedModels.MoveNet,
        {
          modelType: "MultiPose.Lightning",
          enableTracking: true,
          enableSmoothing: true,
          maxPoses: 2, // Optimize for 2 people (attacker + defender)
          flipHorizontal: false,
          // Additional optimization parameters
          minPoseConfidence: 0.1, // Lower threshold for better detection
          minPartConfidence: 0.1, // Lower threshold for keypoint detection
          nmsRadius: 20, // Non-maximum suppression radius
          multiPoseMaxDimension: 256, // Input image size for better performance
        }
      );

      setModelLoaded(true);
      setIsLoading(false);
      console.log("Model loaded successfully!");
    } catch (error) {
      console.error("Error loading model:", error);
      setIsLoading(false);
      alert("Không thể tải mô hình AI. Vui lòng làm mới trang và thử lại.");
    }
  };

  // Initialize model on component mount
  useEffect(() => {
    initializeModel();
  }, []);

  // Skeleton drawing function
  const drawSkeleton = (ctx, poses) => {
    poses.forEach((pose, index) => {
      const keypoints = pose.keypoints;
      const isDefender = pose.id === defenderId.current;
      const isAttacker = pose.id === attackerId.current;

      // Choose colors based on role
      let skeletonColor = "#00ff00"; // default green
      let keypointColor = "#00ff00";
      let bboxColor = "#00ff00";

      if (isDefender) {
        skeletonColor = "#22c55e"; // green for defender
        keypointColor = "#16a34a";
        bboxColor = "#22c55e";
      } else if (isAttacker) {
        skeletonColor = "#ef4444"; // red for attacker
        keypointColor = "#dc2626";
        bboxColor = "#ef4444";
      }

      // Draw bounding box for all poses (outline only)
      const [x, y, w, h] = bboxFromKeypoints(keypoints);

      ctx.strokeStyle = bboxColor;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]); // Dashed line for bbox
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]); // Reset line dash

      // Draw track ID label with background
      const trackIdText = pose.id
        ? `ID: ${Math.round(pose.id)}`
        : `ID: ${index + 1}`;
      const textMetrics = ctx.measureText(trackIdText);
      const textWidth = textMetrics.width;
      const textHeight = 20;

      // Draw background for text
      ctx.fillStyle = bboxColor + "CC"; // Semi-transparent background
      ctx.fillRect(x, y - textHeight - 5, textWidth + 10, textHeight);

      // Draw text
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 16px Arial";
      ctx.textAlign = "left";
      ctx.fillText(trackIdText, x + 5, y - 8);

      // Draw skeleton connections
      ctx.strokeStyle = skeletonColor;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";

      POSE_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const startPoint = keypoints[startIdx];
        const endPoint = keypoints[endIdx];

        if (startPoint.score > 0.3 && endPoint.score > 0.3) {
          ctx.beginPath();
          ctx.moveTo(startPoint.x, startPoint.y);
          ctx.lineTo(endPoint.x, endPoint.y);
          ctx.stroke();
        }
      });

      // Draw keypoints
      keypoints.forEach((keypoint) => {
        if (keypoint.score > 0.3) {
          ctx.fillStyle = keypointColor;
          ctx.beginPath();
          ctx.arc(keypoint.x, keypoint.y, 4, 0, 2 * Math.PI);
          ctx.fill();

          // Add a white border
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      // Draw role label
      if (isDefender || isAttacker) {
        const label = isDefender ? "DEFENDER" : "ATTACKER";
        const headPoint = keypoints[0]; // nose
        if (headPoint.score > 0.3) {
          ctx.fillStyle = skeletonColor;
          ctx.font = "bold 14px Arial";
          ctx.textAlign = "center";
          ctx.fillText(label, headPoint.x, headPoint.y - 20);
        }
      }
    });
  };

  const snapshot = () => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.drawImage(
      videoRef.current,
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );
    return canvasRef.current.toDataURL("image/png");
  };

  const addToGallery = (img, label, feedback = null) => {
    // Generate Vietnamese feedback if not provided
    let vietnameseFeedback = feedback;
    if (!vietnameseFeedback) {
      switch (label.toLowerCase()) {
        case "kick":
          vietnameseFeedback = "Cú đá được ghi lại! Kỹ thuật tốt.";
          break;
        case "punch":
          vietnameseFeedback = "Cú đấm được ghi lại! Tốc độ tốt.";
          break;
        case "block":
          vietnameseFeedback = "Phòng thủ được ghi lại! Phản xạ nhanh.";
          break;
        case "dodge":
          vietnameseFeedback = "Cú né được ghi lại! Di chuyển linh hoạt.";
          break;
        default:
          vietnameseFeedback = "Hành động được ghi lại!";
      }
    }

    setGallery((g) => [...g, { img, label, feedback: vietnameseFeedback }]);
    setCounts((c) => ({
      ...c,
      [label.toLowerCase()]: c[label.toLowerCase()] + 1,
    }));
    setLastAction({ type: label, timestamp: Date.now() });
  };

  // Clear all data function
  const clearAllData = () => {
    setGallery([]);
    setCounts({ kick: 0, punch: 0, block: 0, dodge: 0 });
    setLastAction(null);
    setIsTrainingActive(false);
    setShowRoleSelection(false);
    setRoleSelectionWarning("");
    setIsVideoPaused(false);
    setVideoPausedForRoleSelection(false);
    setRecommendations([]);
    defenderId.current = null;
    attackerId.current = null;
    baselineDefenderX.current = null;
    videoTrack.current = null;

    // Reset cooldown timers
    lastActionTime.current = {
      kick: 0,
      punch: 0,
      block: 0,
      dodge: 0,
    };

    // Reset pose analyzer for new training session
    poseAnalyzer.resetBaselines();
  };

  // Start webcam function
  const startWebcam = async () => {
    try {
      if (!modelLoaded) {
        alert("Mô hình AI đang tải. Vui lòng chờ và thử lại.");
        return;
      }

      setIsLoading(true);
      clearAllData();

      // Get camera stream with optimized settings for pose detection
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640, min: 320, max: 1280 },
          height: { ideal: 480, min: 240, max: 720 },
          frameRate: { ideal: 30, max: 30 }, // Limit to 30fps for better performance
          facingMode: "user", // Front camera for better lighting
          // Additional camera optimizations
          focusMode: "continuous",
          whiteBalanceMode: "continuous",
          exposureMode: "continuous",
        },
        audio: false,
      });

      // Store video track for dimension fallback
      videoTrack.current = stream.getVideoTracks()[0];

      // Set video source and wait for it to be ready
      if (!videoRef.current) {
        throw new Error("Video element not available");
      }

      const video = videoRef.current;
      video.srcObject = stream;

      // Wait for video to be ready using polling
      await new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 100; // 5 seconds at 50ms intervals

        const checkVideoReady = () => {
          attempts++;

          if (video.videoWidth > 0 && video.videoHeight > 0) {
            resolve();
            return;
          }

          if (attempts >= maxAttempts) {
            resolve(); // Proceed even if dimensions are 0
            return;
          }

          setTimeout(checkVideoReady, 50);
        };

        setTimeout(checkVideoReady, 100);
      });

      // Model is already loaded at app startup

      // Start detection
      setIsLoading(false);
      setIsWebcamActive(true);
      setIsDetecting(true);
    } catch (error) {
      console.error("Error initializing camera:", error);
      setIsLoading(false);
      alert("Không thể truy cập camera. Vui lòng kiểm tra quyền và thử lại.");
    }
  };

  // Stop webcam function
  const stopWebcam = () => {
    if (videoRef.current) {
      if (videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      if (videoRef.current.src) {
        URL.revokeObjectURL(videoRef.current.src);
        videoRef.current.src = "";
      }
    }

    setIsWebcamActive(false);
    setIsDetecting(false);
    setShowRoleSelection(false);
    setAvailablePoses([]);
    setIsVideoUploaded(false);
    setVideoFile(null);
    setIsVideoPaused(false);
    setVideoPausedForRoleSelection(false);
    defenderId.current = null;
    attackerId.current = null;
    baselineDefenderX.current = null;
    videoTrack.current = null;
  };

  // Assign defender function - automatically assigns the other person as attacker
  const assignDefender = (defenderTrackId) => {
    const attackerTrackId = availablePoses.find(
      (p) => p.id !== defenderTrackId
    )?.id;

    if (attackerTrackId) {
      attackerId.current = attackerTrackId;
      defenderId.current = defenderTrackId;
      setSelectedRoles({
        attacker: attackerTrackId,
        defender: defenderTrackId,
      });
      setShowRoleSelection(false);
      setIsTrainingActive(true);

      // Resume video playback if it was paused for role selection (only for video upload)
      if (videoPausedForRoleSelection && videoRef.current && isVideoUploaded) {
        // Resume video playback
        videoRef.current.play();
        setIsVideoPaused(false);
        setVideoPausedForRoleSelection(false);
      }
    }
  };

  // Upload video function
  const uploadVideo = async (file) => {
    try {
      if (!modelLoaded) {
        alert("Mô hình AI đang tải. Vui lòng chờ và thử lại.");
        return;
      }

      setIsLoading(true);
      clearAllData();
      setVideoFile(file);
      setIsVideoUploaded(true);

      // Set video source
      if (!videoRef.current) {
        throw new Error("Video element not available");
      }

      const video = videoRef.current;
      video.src = URL.createObjectURL(file);

      // Wait for video to be ready
      await new Promise((resolve) => {
        const onLoadedMetadata = () => {
          video.removeEventListener("loadedmetadata", onLoadedMetadata);
          resolve();
        };
        video.addEventListener("loadedmetadata", onLoadedMetadata);
      });

      // Model is already loaded at app startup

      // Start detection (but don't show role selection yet)
      setIsLoading(false);
      setIsWebcamActive(true);
      setIsDetecting(true);

      // Set up video to pause on first frame with 2 people
      video.play();
    } catch (error) {
      console.error("Error uploading video:", error);
      setIsLoading(false);
      alert("Không thể tải video. Vui lòng thử lại.");
    }
  };

  // Handle file input change
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith("video/")) {
      uploadVideo(file);
    } else {
      alert("Vui lòng chọn file video hợp lệ.");
    }
  };

  // Start training function
  const startTraining = () => {
    if (!isWebcamActive) {
      alert("Vui lòng bật camera hoặc tải video trước!");
      return;
    }

    // If training is already active, don't show role selection again
    if (isTrainingActive) {
      return;
    }

    // For video upload, the video will auto-pause when 2 people are detected
    if (isVideoUploaded) {
      if (videoPausedForRoleSelection) {
        // Video is already paused for role selection, just show the modal
        setShowRoleSelection(true);
        setRoleSelectionWarning("");
      } else {
        // Video is playing, wait for auto-pause
        setRoleSelectionWarning("Đang chờ phát hiện 2 người trong video...");
      }
      return;
    }

    // For camera mode, show role selection immediately (like video upload)
    // Don't check for 2 people here - let the detection loop handle it
    setShowRoleSelection(true);
    setRoleSelectionWarning(
      "Đang chờ phát hiện 2 người để chọn vai trò... (Webcam vẫn chạy)"
    );
  };

  const processAction = (type, condition, metric, feedback = null) => {
    // For the new simplified analyzer, actions are detected immediately
    // So we just capture the keyframe when an action is detected
    if (condition) {
      const now = Date.now();
      const cooldownTime = 1000; // 1 second cooldown between captures

      // Check if enough time has passed since last capture of this action type
      if (now - lastActionTime.current[type] > cooldownTime) {
        const img = snapshot();
        addToGallery(img, type.toUpperCase(), feedback);
        lastActionTime.current[type] = now;
      }
    }
  };

  // Detection loop effect
  useEffect(() => {
    let animationId;

    const loop = async () => {
      if (isWebcamActive && detector.current && videoRef.current) {
        try {
          // Check if video has valid dimensions before processing
          const video = videoRef.current;
          if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
            if (isWebcamActive) {
              animationId = requestAnimationFrame(loop);
            }
            return;
          }

          // Use videoWidth/videoHeight if available
          let videoWidth = video.videoWidth;
          let videoHeight = video.videoHeight;

          // Optimize pose estimation with better parameters
          const poses = await detector.current.estimatePoses(video, {
            flipHorizontal: false,
            maxPoses: 2,
            scoreThreshold: 0.1, // Lower threshold for better detection
            nmsRadius: 20,
            // Additional optimizations
            multiPoseMaxDimension: 256, // Smaller input size for better performance
            enableSmoothing: true,
            enableTracking: true,
          });

          console.log(
            "Detected poses:",
            poses.length,
            poses.map((p) => ({
              score: p.score,
              id: p.id,
              keypoints: p.keypoints.filter((kp) => kp.score > 0.3).length,
            }))
          );

          // Enhanced pose filtering for better people detection
          const filteredPoses = poses.filter((pose) => {
            // Lower overall pose confidence threshold
            if (pose.score < 0.1) return false;

            // Count valid keypoints (head, shoulders, hips, knees, ankles)
            const criticalKeypoints = [0, 5, 6, 11, 12, 13, 14, 15, 16]; // nose, shoulders, hips, knees, ankles
            const validCriticalKeypoints = criticalKeypoints.filter(
              (index) =>
                pose.keypoints[index] && pose.keypoints[index].score > 0.2
            ).length;

            // Count all valid keypoints
            const validKeypoints = pose.keypoints.filter(
              (kp) => kp.score > 0.2
            ).length;

            // Require at least 4 critical keypoints and 6 total keypoints
            return validCriticalKeypoints >= 4 && validKeypoints >= 6;
          });

          // MoveNet with enableTracking: true already provides trackId
          // No need for custom SORT tracking

          // Update available poses for role selection (only if roles not assigned yet)
          if (!isTrainingActive) {
            const posesWithTrackId = filteredPoses.filter((p) => p.id);
            setAvailablePoses(posesWithTrackId);
          }

          // Auto-pause video on first frame with 2 people for role selection (only if roles not assigned)
          if (
            isVideoUploaded &&
            !videoPausedForRoleSelection &&
            !isTrainingActive &&
            filteredPoses.length >= 2
          ) {
            const video = videoRef.current;
            if (video && !video.paused) {
              video.pause();
              setIsVideoPaused(true);
              setVideoPausedForRoleSelection(true);
              setShowRoleSelection(true);
              setAvailablePoses(filteredPoses.filter((p) => p.id));
            }
          }

          // For webcam mode, show role selection without pausing the webcam
          if (
            !isVideoUploaded &&
            showRoleSelection &&
            !isTrainingActive &&
            !videoPausedForRoleSelection &&
            filteredPoses.length >= 2
          ) {
            // Keep webcam running and just show role selection
            setAvailablePoses(filteredPoses.filter((p) => p.id));
            setRoleSelectionWarning(""); // Clear the waiting message
          }

          // Draw skeleton on canvas (always show, even with fewer people)
          const canvas = canvasRef.current;
          if (!canvas) {
            console.log("Canvas not found!");
            if (isWebcamActive) {
              animationId = requestAnimationFrame(loop);
            }
            return;
          }

          const ctx = canvas.getContext("2d");

          // Set canvas dimensions to match video stream dimensions
          canvas.width = videoWidth;
          canvas.height = videoHeight;

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          drawSkeleton(ctx, filteredPoses);

          // Only process actions if training is active and roles are assigned
          if (isTrainingActive && defenderId.current && attackerId.current) {
            const defender = filteredPoses.find(
              (p) => p.id === defenderId.current
            );
            const attacker = filteredPoses.find(
              (p) => p.id === attackerId.current
            );

            if (defender && attacker) {
              // Use advanced pose analyzer for more accurate detection
              const analysisResult = poseAnalyzer.analyzePoses(
                defender,
                attacker
              );

              // Process each detected action
              analysisResult.actions.forEach((action) => {
                processAction(
                  action.type,
                  true, // Action is detected
                  action.confidence, // Use confidence as metric
                  action.feedback?.message // Pass the feedback message
                );
              });

              // Update feedback from detected actions
              if (analysisResult.feedback.length > 0) {
                setRecommendations(analysisResult.feedback);
              }

              // Update baseline for defender position (for backward compatibility)
              if (!baselineDefenderX.current) {
                baselineDefenderX.current =
                  (defender.keypoints[11].x + defender.keypoints[12].x) / 2;
              }
            }
          }
        } catch (error) {
          console.error("Error in detection loop:", error);
          // If it's a texture size error, try to recover
          if (
            error.message.includes("texture size") ||
            error.message.includes("0x0")
          ) {
            // Wait a bit before continuing
            setTimeout(() => {
              if (isWebcamActive) {
                animationId = requestAnimationFrame(loop);
              }
            }, 100);
            return;
          }
        }
      }

      if (isWebcamActive) {
        animationId = requestAnimationFrame(loop);
      }
    };

    if (isWebcamActive) {
      loop();
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isWebcamActive, showRoleSelection]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-400 to-red-400 bg-clip-text text-transparent">
            🥋 Huấn Luyện Viên Võ Thuật AI
          </h1>
          <p className="text-center text-gray-300 mt-2">
            Phân tích hành động võ thuật thời gian thực với nhận dạng tư thế
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Webcam Controls */}
        <div className="mb-8">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <span className="text-2xl mr-3">🎥</span>
              Điều Khiển Camera
            </h2>

            <div className="flex items-center space-x-4">
              {!isWebcamActive ? (
                <>
                  <button
                    onClick={startWebcam}
                    disabled={isLoading || !modelLoaded}
                    className="bg-green-500 hover:bg-green-600 disabled:bg-gray-500 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Đang khởi động...</span>
                      </>
                    ) : !modelLoaded ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Đang tải mô hình...</span>
                      </>
                    ) : (
                      <>
                        <span>📹</span>
                        <span>Bật Camera</span>
                      </>
                    )}
                  </button>

                  <div className="relative">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleFileChange}
                      disabled={!modelLoaded}
                      className="hidden"
                      id="video-upload"
                    />
                    <label
                      htmlFor="video-upload"
                      className={`${
                        !modelLoaded
                          ? "bg-gray-500 cursor-not-allowed"
                          : "bg-purple-500 hover:bg-purple-600 cursor-pointer"
                      } text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2`}
                    >
                      <span>📁</span>
                      <span>Tải Video</span>
                    </label>
                  </div>
                </>
              ) : (
                <div className="flex items-center space-x-4">
                  <button
                    onClick={stopWebcam}
                    className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
                  >
                    <span>⏹️</span>
                    <span>Dừng {isVideoUploaded ? "Video" : "Camera"}</span>
                  </button>

                  {!isTrainingActive && (
                    <button
                      onClick={startTraining}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
                    >
                      <span>🥋</span>
                      <span>Bắt Đầu Huấn Luyện</span>
                    </button>
                  )}

                  {isTrainingActive && (
                    <div className="flex items-center space-x-2 text-orange-400">
                      <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                      <span className="text-sm">Đang Huấn Luyện</span>
                    </div>
                  )}

                  {/* Video Play/Pause Control */}
                  {isVideoUploaded && isWebcamActive && (
                    <button
                      onClick={() => {
                        const video = videoRef.current;
                        if (video) {
                          if (video.paused) {
                            video.play();
                            setIsVideoPaused(false);
                          } else {
                            video.pause();
                            setIsVideoPaused(true);
                          }
                        }
                      }}
                      className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                    >
                      <span>{isVideoPaused ? "▶️" : "⏸️"}</span>
                      <span>{isVideoPaused ? "Phát" : "Tạm Dừng"}</span>
                    </button>
                  )}
                </div>
              )}

              {isWebcamActive && (
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-green-400">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm">
                      {isVideoUploaded
                        ? "Video Đang Hoạt Động"
                        : "Camera Đang Hoạt Động"}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      stopWebcam();
                      setTimeout(() => startWebcam(), 100);
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    🔄 Khởi Động Lại
                  </button>
                </div>
              )}
            </div>

            {/* Warning Message */}
            {roleSelectionWarning && (
              <div className="mt-4 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                <div className="flex items-center space-x-2 text-yellow-400">
                  <span>⚠️</span>
                  <span className="font-medium">{roleSelectionWarning}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Video Feed Section */}
          <div className="lg:col-span-2">
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

              <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl">
                {/* Always render video element for ref access */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  width="640"
                  height="480"
                  className="hidden"
                />

                {!isWebcamActive ? (
                  <div className="flex items-center justify-center h-96 bg-gray-800">
                    <div className="text-center">
                      <div className="text-6xl mb-4">📹</div>
                      <p className="text-gray-300 text-lg">
                        Nhấn "Bật Camera" để bắt đầu
                      </p>
                      <p className="text-gray-400 text-sm mt-2">
                        Đặt hai người trong tầm nhìn camera
                      </p>
                    </div>
                  </div>
                ) : isLoading ? (
                  <div className="flex items-center justify-center h-96 bg-gray-800">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                      <p className="text-gray-300">
                        {!modelLoaded
                          ? "Đang tải mô hình AI..."
                          : "Đang khởi tạo camera..."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <canvas
                      ref={canvasRef}
                      width="640"
                      height="480"
                      className="w-full h-full pointer-events-none"
                    />
                  </>
                )}

                {/* Overlay Info */}
                {isWebcamActive && !showRoleSelection && (
                  <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2">
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-green-400">Đang Phát Hiện</span>
                      </div>
                      {isTrainingActive ? (
                        <>
                          <div className="flex items-center">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                            <span>Người Phòng Thủ</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                            <span>Người Tấn Công</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-yellow-400">
                          {videoPausedForRoleSelection
                            ? isVideoUploaded
                              ? "Video tạm dừng - Chọn vai trò để tiếp tục"
                              : "Camera tạm dừng - Chọn vai trò để tiếp tục"
                            : isVideoUploaded
                            ? "Video đang phát - Nhấn 'Bắt Đầu Huấn Luyện' để tạm dừng chọn vai trò"
                            : showRoleSelection
                            ? "Đang chờ phát hiện 2 người để chọn vai trò... (Webcam vẫn chạy)"
                            : 'Nhấn "Bắt Đầu Huấn Luyện" để chọn vai trò và bắt đầu phân tích'}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Role Selection Prompt */}
                {showRoleSelection && (
                  <div className="absolute top-4 left-4 right-4 bg-blue-500/90 backdrop-blur-sm rounded-lg px-4 py-3">
                    <div className="text-center">
                      <p className="text-white font-semibold">
                        🎯 Chọn Vai Trò Võ Sĩ
                      </p>
                      <p className="text-white/80 text-sm mt-1">
                        Phát hiện {availablePoses.length} người
                      </p>
                    </div>
                  </div>
                )}

                {/* Last Action Indicator */}
                {lastAction && (
                  <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-300">
                        Hành Động Cuối:
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          lastAction.type === "KICK"
                            ? "bg-red-500/80 text-white"
                            : lastAction.type === "PUNCH"
                            ? "bg-orange-500/80 text-white"
                            : lastAction.type === "BLOCK"
                            ? "bg-green-500/80 text-white"
                            : lastAction.type === "DODGE"
                            ? "bg-purple-500/80 text-white"
                            : "bg-green-500/80 text-white"
                        }`}
                      >
                        {lastAction.type}
                      </span>
                    </div>
                  </div>
                )}

                {/* Detection Status */}
                {isDetecting && (
                  <div className="absolute bottom-4 left-4 bg-green-500/80 backdrop-blur-sm rounded-lg px-3 py-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                      <span className="text-sm text-white font-medium">
                        AI Đang Phát Hiện
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats Dashboard */}
          <div className="space-y-6">
            {/* Role Selection - Small Panel Beside Video */}
            {showRoleSelection &&
              availablePoses.length > 0 &&
              !isTrainingActive && (
                <div className="lg:col-span-2">
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-4 border border-gray-700">
                    <h3 className="text-lg font-bold mb-3 text-center text-white">
                      🥋 Chọn Vai Trò Võ Sĩ
                    </h3>
                    <p className="text-gray-300 text-center mb-4 text-sm">
                      {availablePoses.length >= 2
                        ? "Chọn người nào là Người Phòng Thủ (Xanh) - người còn lại sẽ là Người Tấn Công (Đỏ)"
                        : "Chỉ phát hiện một người. Bạn vẫn có thể phân tích tư thế, nhưng phát hiện hành động cần hai người."}
                      {videoPausedForRoleSelection && (
                        <span className="block text-xs text-blue-400 mt-1">
                          📹 {isVideoUploaded ? "Video" : "Camera"} tạm dừng -
                          Chọn người phòng thủ để tiếp tục phân tích
                        </span>
                      )}
                      {!videoPausedForRoleSelection &&
                        showRoleSelection &&
                        availablePoses.length < 2 && (
                          <span className="block text-xs text-blue-400 mt-1">
                            📹 Camera đang hoạt động - Đang chờ phát hiện 2
                            người
                          </span>
                        )}
                      {!videoPausedForRoleSelection &&
                        showRoleSelection &&
                        availablePoses.length >= 2 && (
                          <span className="block text-xs text-green-400 mt-1">
                            📹 Camera vẫn chạy - Chọn người phòng thủ để bắt đầu
                          </span>
                        )}
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      {availablePoses.slice(0, 2).map((pose, index) => (
                        <div key={pose.id} className="space-y-2">
                          <div className="bg-gray-700 rounded-lg p-3 text-center">
                            <div className="text-sm font-semibold mb-1 text-white">
                              Người {index + 1}
                            </div>
                            <div className="text-xs text-gray-400 mb-2">
                              ID Theo Dõi: {pose.id}
                            </div>

                            {availablePoses.length >= 2 ? (
                              <button
                                onClick={() => assignDefender(pose.id)}
                                className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-3 rounded-lg font-medium transition-colors text-sm"
                              >
                                🟢 Làm Người Phòng Thủ
                              </button>
                            ) : (
                              <button
                                onClick={() => setShowRoleSelection(false)}
                                className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 px-3 rounded-lg font-medium transition-colors text-sm"
                              >
                                Tiếp Tục Phân Tích Tư Thế
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {availablePoses.length >= 2 && (
                      <div className="mt-3 text-center">
                        <p className="text-xs text-gray-400">
                          💡 Mẹo: Nhấn "Làm Người Phòng Thủ" cho người sẽ phòng
                          thủ - người còn lại tự động trở thành người tấn công
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <span className="text-2xl mr-3">📊</span>
                Thống Kê Hành Động
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-xl p-4 border border-red-500/30">
                  <div className="text-3xl font-bold text-red-400">
                    {counts.kick}
                  </div>
                  <div className="text-sm text-gray-300">Cú Đá</div>
                  <div className="text-xs text-red-300 mt-1">
                    ⚡ Tác Động Mạnh
                  </div>
                </div>

                <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-xl p-4 border border-orange-500/30">
                  <div className="text-3xl font-bold text-orange-400">
                    {counts.punch}
                  </div>
                  <div className="text-sm text-gray-300">Cú Đấm</div>
                  <div className="text-xs text-orange-300 mt-1">
                    👊 Đòn Nhanh
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl p-4 border border-green-500/30">
                  <div className="text-3xl font-bold text-green-400">
                    {counts.block}
                  </div>
                  <div className="text-sm text-gray-300">Cú Chặn</div>
                  <div className="text-xs text-green-300 mt-1">
                    🛡️ Phòng Thủ
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl p-4 border border-purple-500/30">
                  <div className="text-3xl font-bold text-purple-400">
                    {counts.dodge}
                  </div>
                  <div className="text-sm text-gray-300">Cú Né</div>
                  <div className="text-xs text-purple-300 mt-1">
                    💨 Tránh Né
                  </div>
                </div>
              </div>
            </div>

            {/* Total Actions */}
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl p-6 border border-purple-500/30">
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-400">
                  {counts.kick + counts.punch + counts.block + counts.dodge}
                </div>
                <div className="text-lg text-gray-300">Tổng Hành Động</div>
                <div className="text-sm text-purple-300 mt-2">
                  🎯 Phiên Huấn Luyện
                </div>
              </div>
            </div>

            {/* Action Feedback */}
            {recommendations.length > 0 && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <span className="text-2xl mr-3">💡</span>
                  Phản Hồi Hành Động
                </h2>

                <div className="space-y-3">
                  {recommendations.map((rec, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-l-4 ${
                        rec.priority === "high"
                          ? "bg-red-500/10 border-red-500 text-red-300"
                          : rec.priority === "medium"
                          ? "bg-yellow-500/10 border-yellow-500 text-yellow-300"
                          : "bg-green-500/10 border-green-500 text-green-300"
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <span className="text-lg font-medium">
                          {rec.priority === "high"
                            ? "🔴"
                            : rec.priority === "medium"
                            ? "🟡"
                            : "🟢"}
                        </span>
                        <div className="flex-1">
                          <span className="text-sm font-medium">
                            {rec.message}
                          </span>

                          {/* Keyframe Information */}
                          {rec.keyframe && (
                            <div className="mt-2 p-2 bg-gray-700/50 rounded-lg">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="text-xs font-semibold text-blue-300">
                                  📸 Keyframe: {rec.keyframe.action}
                                </span>
                                <span className="text-xs text-gray-400">
                                  ({rec.keyframe.frameCount} frames)
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-1 text-xs text-gray-300">
                                {Object.entries(rec.keyframe.metrics).map(
                                  ([key, value]) => (
                                    <div
                                      key={key}
                                      className="flex justify-between"
                                    >
                                      <span className="capitalize">{key}:</span>
                                      <span className="font-medium">
                                        {value}
                                      </span>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          )}

                          {/* Movement Analysis Information */}
                          {rec.movement && (
                            <div className="mt-2 p-2 bg-purple-700/30 rounded-lg border border-purple-500/30">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="text-xs font-semibold text-purple-300">
                                  🏃 Phân Tích Chuyển Động
                                </span>
                                <span className="text-xs text-gray-400">
                                  ({rec.movement.totalFrames} frames)
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-1 text-xs text-gray-300">
                                {Object.entries(rec.movement).map(
                                  ([key, value]) => {
                                    if (key === "totalFrames") return null;
                                    return (
                                      <div
                                        key={key}
                                        className="flex justify-between"
                                      >
                                        <span className="capitalize">
                                          {key}:
                                        </span>
                                        <span className="font-medium">
                                          {value}
                                        </span>
                                      </div>
                                    );
                                  }
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Gallery */}
        {gallery.length > 0 && (
          <div className="mt-8">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold flex items-center">
                  <span className="text-2xl mr-3">📸</span>
                  Hành Động Đã Chụp
                  <span className="ml-3 bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm">
                    {gallery.length} đã chụp
                  </span>
                </h2>
                {gallery.length > 0 && (
                  <button
                    onClick={() => setGallery([])}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-red-500/30"
                  >
                    Xóa Thư Viện
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {gallery.map((g, i) => (
                  <div
                    key={i}
                    className="group cursor-pointer transform transition-all duration-300 hover:scale-105"
                    onClick={() => {
                      const win = window.open();
                      win.document.write(`
                        <html>
                          <head>
                             <title>${
                               g.label
                             } - Huấn Luyện Viên Võ Thuật AI</title>
                            <style>
                              body { 
                                margin: 0; 
                                padding: 20px; 
                                background: #1f2937; 
                                color: white; 
                                font-family: Arial, sans-serif;
                                text-align: center;
                              }
                              img { 
                                max-width: 100%; 
                                height: auto; 
                                border-radius: 12px;
                                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
                              }
                              h2 {
                                background: linear-gradient(45deg, #3b82f6, #ef4444);
                                -webkit-background-clip: text;
                                -webkit-text-fill-color: transparent;
                                font-size: 2rem;
                                margin-bottom: 20px;
                              }
                            </style>
                          </head>
                          <body>
                            <h2>${g.label}</h2>
                            <img src="${g.img}" alt="${g.label}">
                            ${
                              g.feedback
                                ? `<div style="margin-top: 20px; padding: 15px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border: 1px solid #3b82f6;"><h3 style="color: #3b82f6; margin-bottom: 10px;">💡 Phản Hồi:</h3><p style="color: #e5e7eb;">${g.feedback}</p></div>`
                                : ""
                            }
                          </body>
                        </html>
                      `);
                    }}
                  >
                    <div className="relative bg-gray-700 rounded-xl overflow-hidden border border-gray-600 group-hover:border-blue-500 transition-colors">
                      <img
                        src={g.img}
                        alt={g.label}
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-2 left-2 right-2">
                          <div className="text-white font-semibold text-sm">
                            {g.label}
                          </div>
                          {g.feedback && (
                            <div className="text-blue-300 text-xs mt-1 line-clamp-2">
                              💡 {g.feedback}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="absolute top-2 right-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            g.label === "KICK"
                              ? "bg-red-500/80 text-white"
                              : g.label === "PUNCH"
                              ? "bg-orange-500/80 text-white"
                              : g.label === "BLOCK"
                              ? "bg-green-500/80 text-white"
                              : g.label === "DODGE"
                              ? "bg-purple-500/80 text-white"
                              : "bg-green-500/80 text-white"
                          }`}
                        >
                          {g.label}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
