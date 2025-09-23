import React, { useState, useEffect, useRef } from "react";
import {
  detectStablePose,
  detectActionCompletion,
  detectActionMovement,
  detectActionCompletionPattern,
  analyzePoseSequence,
} from "../utils/poseStability";

const KeyFrameExtractor = ({
  currentPoses,
  isTrainingSession,
  onKeyFrameCaptured,
  onAnalysisComplete,
  defenderTrackId,
  onCaptureWebcamFrame,
}) => {
  const [poseHistory, setPoseHistory] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedFrames, setExtractedFrames] = useState([]);
  const [stabilityScore, setStabilityScore] = useState(0);
  const [lastStableTime, setLastStableTime] = useState(0);

  const historyRef = useRef([]);
  const lastCaptureTimeRef = useRef(0);
  const minCaptureInterval = 4000; // 4 seconds between captures

  // Action sequence tracking for martial arts
  const actionSequenceRef = useRef([]);
  const lastActionTypeRef = useRef(null);
  const actionStartTimeRef = useRef(0);
  const actionCooldownRef = useRef(0);

  // Reset action sequence when training session starts
  useEffect(() => {
    if (isTrainingSession) {
      actionSequenceRef.current = [];
      lastActionTypeRef.current = null;
      actionStartTimeRef.current = 0;
      actionCooldownRef.current = 0;
      lastCaptureTimeRef.current = 0;
    }
  }, [isTrainingSession]);

  // Check if we should capture based on action sequence patterns
  const shouldCaptureKeyframe = (actionType, confidence) => {
    const currentTime = Date.now();

    // Basic cooldown check
    if (currentTime - lastCaptureTimeRef.current < minCaptureInterval) {
      return false;
    }

    // Action-specific cooldown (prevent capturing same action type too frequently)
    if (
      actionType === lastActionTypeRef.current &&
      currentTime - actionCooldownRef.current < 6000
    ) {
      // 6 seconds for same action type
      return false;
    }

    // Track action sequence
    if (actionType !== lastActionTypeRef.current) {
      // New action type detected
      actionSequenceRef.current.push({
        type: actionType,
        startTime: currentTime,
        confidence: confidence,
      });

      // Keep only last 5 actions in sequence
      if (actionSequenceRef.current.length > 5) {
        actionSequenceRef.current.shift();
      }

      lastActionTypeRef.current = actionType;
      actionStartTimeRef.current = currentTime;
    }

    // For action movements, only capture if confidence is high and it's a clear action
    if (["punching", "kicking", "blocking"].includes(actionType)) {
      return confidence > 0.6; // Higher threshold for action movements
    }

    // For action completion, capture if it's been a while since last capture
    if (actionType === "action_completion") {
      return (
        confidence > 0.7 && currentTime - lastCaptureTimeRef.current > 5000
      );
    }

    // For stable poses, only capture if it's been a long time since last capture
    if (actionType === "stable_pose") {
      return (
        confidence > 0.85 && currentTime - lastCaptureTimeRef.current > 8000
      );
    }

    return false;
  };

  // Update pose history when new poses arrive
  useEffect(() => {
    if (
      !isTrainingSession ||
      !currentPoses ||
      currentPoses.length === 0 ||
      !defenderTrackId
    ) {
      return;
    }

    // Find the defender pose by track ID
    const defenderPose = currentPoses.find(
      (pose) => pose.track_id === defenderTrackId
    );
    if (!defenderPose || !defenderPose.keypoints_2d) {
      return;
    }

    // Capture webcam frame if available
    let webcamFrame = null;
    if (onCaptureWebcamFrame) {
      try {
        webcamFrame = onCaptureWebcamFrame();
      } catch (error) {
        console.warn("Failed to capture webcam frame:", error);
      }
    }

    // Add defender pose to history with webcam frame
    const newPose = {
      ...defenderPose,
      timestamp: Date.now(),
      frameIndex: historyRef.current.length,
      webcamFrame: webcamFrame, // Store webcam frame with pose
    };

    historyRef.current.push(newPose);

    // Keep only last 100 poses to prevent memory issues
    if (historyRef.current.length > 100) {
      historyRef.current = historyRef.current.slice(-100);
    }

    setPoseHistory([...historyRef.current]);
  }, [currentPoses, isTrainingSession, defenderTrackId, onCaptureWebcamFrame]);

  // Analyze pose stability and extract key frames
  useEffect(() => {
    if (!isTrainingSession || poseHistory.length < 15) {
      return;
    }

    const currentTime = Date.now();

    // First, try to detect action movements (punching, kicking, blocking)
    const actionResult = detectActionMovement(poseHistory);
    if (
      actionResult &&
      shouldCaptureKeyframe(actionResult.type, actionResult.confidence)
    ) {
      console.log(
        "Action captured:",
        actionResult.type,
        "confidence:",
        actionResult.confidence,
        "sequence:",
        actionSequenceRef.current.map((a) => a.type).join(" -> ")
      );
      captureKeyFrame({
        isStable: false,
        stabilityScore: actionResult.confidence,
        keyPose: poseHistory[poseHistory.length - 1],
        frameCount: poseHistory.length,
        timestamp: actionResult.timestamp,
        type: actionResult.type,
        motionMagnitude: actionResult.motionMagnitude,
        peakMotion: actionResult.peakMotion,
        activeJoints: actionResult.activeJoints,
      });
      lastCaptureTimeRef.current = currentTime;
      actionCooldownRef.current = currentTime;
      return;
    }

    // Then, try to detect action completion
    const completionResult = detectActionCompletionPattern(poseHistory);
    if (
      completionResult &&
      shouldCaptureKeyframe(completionResult.type, completionResult.confidence)
    ) {
      console.log(
        "Action completion captured:",
        completionResult.type,
        "confidence:",
        completionResult.confidence,
        "sequence:",
        actionSequenceRef.current.map((a) => a.type).join(" -> ")
      );
      captureKeyFrame({
        isStable: true,
        stabilityScore: completionResult.confidence,
        keyPose: poseHistory[poseHistory.length - 1],
        frameCount: poseHistory.length,
        timestamp: completionResult.timestamp,
        type: completionResult.type,
        motionPattern: completionResult.motionPattern,
      });
      lastCaptureTimeRef.current = currentTime;
      actionCooldownRef.current = currentTime;
      return;
    }

    // Finally, detect stable poses (for stance detection) - only if no recent action
    const stabilityResult = detectStablePose(poseHistory, 0.85, 30);
    if (
      stabilityResult &&
      stabilityResult.isStable &&
      shouldCaptureKeyframe("stable_pose", stabilityResult.stabilityScore)
    ) {
      console.log(
        "Stable pose captured:",
        stabilityResult.type,
        "stability:",
        stabilityResult.stabilityScore,
        "sequence:",
        actionSequenceRef.current.map((a) => a.type).join(" -> ")
      );
      setStabilityScore(stabilityResult.stabilityScore);
      captureKeyFrame(stabilityResult);
      lastCaptureTimeRef.current = currentTime;
      actionCooldownRef.current = currentTime;
    }
  }, [poseHistory, isTrainingSession]);

  // Capture key frame
  const captureKeyFrame = (stabilityResult) => {
    if (!stabilityResult.keyPose) {
      return;
    }

    // Get the motion sequence (20 frames before + current frame)
    // The webcam frames are already stored in the pose history
    const motionSequence = historyRef.current.slice(-20).map((pose) => ({
      keypoints_2d: pose.keypoints_2d,
      timestamp: pose.timestamp,
      track_id: pose.track_id,
      webcamFrame: pose.webcamFrame || null, // Include webcam frame from history
    }));

    const keyFrame = {
      id: Date.now(),
      pose: stabilityResult.keyPose,
      stabilityScore: stabilityResult.stabilityScore,
      timestamp: stabilityResult.timestamp,
      type: stabilityResult.type || "stable_pose",
      frameCount: stabilityResult.frameCount,
      motionSequence: motionSequence, // Include motion sequence with webcam frames
    };

    setExtractedFrames((prev) => [...prev.slice(-9), keyFrame]); // Keep last 10
    onKeyFrameCaptured?.(keyFrame);

    // Show extraction feedback
    setIsExtracting(true);
    setTimeout(() => setIsExtracting(false), 1000);
  };

  // Analyze complete sequence when training session ends
  useEffect(() => {
    if (!isTrainingSession && poseHistory.length > 0) {
      const analysis = analyzePoseSequence(poseHistory);
      onAnalysisComplete?.(analysis);

      // Reset for next session
      setPoseHistory([]);
      historyRef.current = [];
      setExtractedFrames([]);
      setStabilityScore(0);
    }
  }, [isTrainingSession, poseHistory, onAnalysisComplete]);

  // Don't render anything if not in training session
  if (!isTrainingSession) {
    return null;
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-white">
          🎯 Trích xuất khung hình chính
        </h3>
        <div className="flex items-center space-x-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isExtracting ? "bg-green-400 animate-pulse" : "bg-gray-500"
            }`}
          />
          <span className="text-sm text-gray-300">
            {isExtracting ? "Đang trích xuất..." : "Chờ phát hiện"}
          </span>
        </div>
      </div>

      {defenderTrackId && (
        <div className="mb-3">
          <p className="text-sm text-gray-300">
            🥋 Theo dõi người bảo vệ:{" "}
            <span className="text-green-400 font-medium">
              ID {defenderTrackId}
            </span>
          </p>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Độ ổn định hiện tại:</span>
          <span className="text-white font-medium">
            {(stabilityScore * 100).toFixed(1)}%
          </span>
        </div>

        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${stabilityScore * 100}%` }}
          />
        </div>

        <div className="text-xs text-gray-500">
          {stabilityScore > 0.7
            ? "✅ Tư thế ổn định - sẵn sàng trích xuất"
            : stabilityScore > 0.4
            ? "⚠️ Tư thế đang ổn định..."
            : "❌ Tư thế không ổn định"}
        </div>
      </div>

      {/* Action sequence display */}
      {actionSequenceRef.current.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="text-xs text-gray-400 mb-1">Chuỗi hành động gần đây:</p>
          <div className="flex flex-wrap gap-1">
            {actionSequenceRef.current.slice(-3).map((action, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full"
                title={`${action.type} (${(action.confidence * 100).toFixed(
                  0
                )}%)`}
              >
                {action.type === "punching"
                  ? "👊"
                  : action.type === "kicking"
                  ? "🦵"
                  : action.type === "blocking"
                  ? "🛡️"
                  : action.type === "action_completion"
                  ? "✅"
                  : action.type === "stable_pose"
                  ? "🧘"
                  : "❓"}
              </span>
            ))}
          </div>
        </div>
      )}

      {extractedFrames.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-700">
          <p className="text-sm text-gray-300 mb-2">
            📸 Đã trích xuất:{" "}
            <span className="text-blue-400 font-medium">
              {extractedFrames.length}
            </span>{" "}
            khung hình
          </p>
          <div className="flex flex-wrap gap-1">
            {extractedFrames.slice(-5).map((frame, index) => (
              <div
                key={index}
                className="w-8 h-8 bg-blue-500/20 border border-blue-400/30 rounded text-xs flex items-center justify-center text-blue-300"
                title={`Khung ${index + 1} - ${new Date(
                  frame.timestamp
                ).toLocaleTimeString()}`}
              >
                {index + 1}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default KeyFrameExtractor;
