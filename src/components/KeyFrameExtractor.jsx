import React, { useState, useEffect, useRef } from "react";
import {
  detectStablePose,
  detectActionCompletion,
  analyzePoseSequence,
} from "../utils/poseStability";

const KeyFrameExtractor = ({
  currentPoses,
  isTrainingSession,
  onKeyFrameCaptured,
  onAnalysisComplete,
  defenderTrackId,
}) => {
  const [poseHistory, setPoseHistory] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedFrames, setExtractedFrames] = useState([]);
  const [stabilityScore, setStabilityScore] = useState(0);
  const [lastStableTime, setLastStableTime] = useState(0);

  const historyRef = useRef([]);
  const lastCaptureTimeRef = useRef(0);
  const minCaptureInterval = 2000; // 2 seconds between captures

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

    // Add defender pose to history
    const newPose = {
      ...defenderPose,
      timestamp: Date.now(),
      frameIndex: historyRef.current.length,
    };

    historyRef.current.push(newPose);

    // Keep only last 100 poses to prevent memory issues
    if (historyRef.current.length > 100) {
      historyRef.current = historyRef.current.slice(-100);
    }

    setPoseHistory([...historyRef.current]);
  }, [currentPoses, isTrainingSession, defenderTrackId]);

  // Analyze pose stability and extract key frames
  useEffect(() => {
    if (!isTrainingSession || poseHistory.length < 30) {
      return;
    }

    // Detect stable poses
    const stabilityResult = detectStablePose(poseHistory, 0.85, 30);

    if (stabilityResult) {
      setStabilityScore(stabilityResult.stabilityScore);

      // Check if we should capture this stable pose
      const currentTime = Date.now();
      if (
        stabilityResult.isStable &&
        currentTime - lastCaptureTimeRef.current >= minCaptureInterval
      ) {
        captureKeyFrame(stabilityResult);
        lastCaptureTimeRef.current = currentTime;
      }
    }

    // Detect action completion
    const actionResult = detectActionCompletion(poseHistory, 0.3, 0.85, 30);

    if (actionResult && actionResult.actionCompleted) {
      const currentTime = Date.now();
      if (currentTime - lastCaptureTimeRef.current >= minCaptureInterval) {
        captureKeyFrame({
          isStable: true,
          stabilityScore: actionResult.laterStability,
          keyPose: actionResult.keyPose,
          frameCount: actionResult.frameCount,
          timestamp: currentTime,
          type: "action_completion",
        });
        lastCaptureTimeRef.current = currentTime;
      }
    }
  }, [poseHistory, isTrainingSession]);

  // Capture key frame
  const captureKeyFrame = (stabilityResult) => {
    if (!stabilityResult.keyPose) {
      return;
    }

    const keyFrame = {
      id: Date.now(),
      pose: stabilityResult.keyPose,
      stabilityScore: stabilityResult.stabilityScore,
      timestamp: stabilityResult.timestamp,
      type: stabilityResult.type || "stable_pose",
      frameCount: stabilityResult.frameCount,
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
    <div className="fixed top-4 left-4 w-64 bg-gray-800/90 backdrop-blur-sm rounded-lg border border-gray-700 p-4 z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <span className="text-xl mr-2">🎯</span>
          Key Frame Extractor
          {defenderTrackId && (
            <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
              Defender ID: {defenderTrackId}
            </span>
          )}
        </h3>
        <div
          className={`w-3 h-3 rounded-full ${
            isExtracting ? "bg-green-500 animate-pulse" : "bg-gray-500"
          }`}
        />
      </div>

      {/* Stability Indicator */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-300">Pose Stability</span>
          <span className="text-sm text-white font-medium">
            {Math.round(stabilityScore * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-600 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              stabilityScore > 0.85
                ? "bg-green-500"
                : stabilityScore > 0.6
                ? "bg-yellow-500"
                : "bg-red-500"
            }`}
            style={{ width: `${stabilityScore * 100}%` }}
          />
        </div>
      </div>

      {/* Frame Count */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">Frames Analyzed</span>
          <span className="text-sm text-white font-medium">
            {poseHistory.length}
          </span>
        </div>
      </div>

      {/* Extracted Frames */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-300">Key Frames</span>
          <span className="text-sm text-white font-medium">
            {extractedFrames.length}
          </span>
        </div>

        {extractedFrames.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {extractedFrames
              .slice(-5)
              .reverse()
              .map((frame) => (
                <div
                  key={frame.id}
                  className="flex items-center justify-between text-xs bg-gray-700/50 rounded p-2"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-green-400">✓</span>
                    <span className="text-gray-300">
                      {frame.type === "action_completion"
                        ? "Action End"
                        : "Stable Pose"}
                    </span>
                  </div>
                  <span className="text-white">
                    {Math.round(frame.stabilityScore * 100)}%
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="text-xs text-gray-400">
        {!defenderTrackId ? (
          <span>Waiting for defender selection...</span>
        ) : poseHistory.length < 30 ? (
          <span>
            Building defender pose history... ({poseHistory.length}/30)
          </span>
        ) : stabilityScore > 0.85 ? (
          <span className="text-green-400">Defender stable pose detected</span>
        ) : (
          <span>Monitoring defender for stable poses</span>
        )}
      </div>

      {/* Extraction Feedback */}
      {isExtracting && (
        <div className="absolute inset-0 bg-green-500/20 rounded-lg flex items-center justify-center">
          <div className="text-green-400 font-semibold animate-pulse">
            Key Frame Captured!
          </div>
        </div>
      )}
    </div>
  );
};

export default KeyFrameExtractor;
