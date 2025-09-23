/**
 * Pose Stability Detection Utilities
 * Detects when poses are stable for key frame extraction
 */

/**
 * Calculate pose similarity between two poses
 */
export const calculatePoseSimilarity = (pose1, pose2) => {
  if (!pose1.keypoints_2d || !pose2.keypoints_2d) {
    return 0;
  }
  
  const keypoints1 = pose1.keypoints_2d;
  const keypoints2 = pose2.keypoints_2d;
  
  if (keypoints1.length !== keypoints2.length) {
    return 0;
  }
  
  let totalDistance = 0;
  let validPoints = 0;
  
  for (let i = 0; i < keypoints1.length; i++) {
    const [x1, y1] = keypoints1[i];
    const [x2, y2] = keypoints2[i];
    
    // Skip invalid keypoints
    if (x1 === 0 && y1 === 0) continue;
    if (x2 === 0 && y2 === 0) continue;
    
    const distance = Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
    totalDistance += distance;
    validPoints++;
  }
  
  if (validPoints === 0) {
    return 0;
  }
  
  const averageDistance = totalDistance / validPoints;
  // Convert distance to similarity (0-1, where 1 is identical)
  const similarity = Math.max(0, 1 - (averageDistance / 100)); // 100 pixels threshold
  
  return similarity;
};

/**
 * Calculate stability score for a sequence of poses
 */
export const calculateStabilityScore = (poseHistory) => {
  if (poseHistory.length < 2) return 0;
  
  let totalSimilarity = 0;
  let comparisons = 0;
  
  // Compare each pose with the previous one
  for (let i = 1; i < poseHistory.length; i++) {
    const similarity = calculatePoseSimilarity(poseHistory[i], poseHistory[i-1]);
    totalSimilarity += similarity;
    comparisons++;
  }
  
  return comparisons > 0 ? totalSimilarity / comparisons : 0;
};

/**
 * Detect if poses are stable within a frame window
 */
export const detectStablePose = (poseHistory, stabilityThreshold = 0.85, minFrames = 30) => {
  if (poseHistory.length < minFrames) return null;
  
  // Get the last minFrames poses
  const recentPoses = poseHistory.slice(-minFrames);
  
  // Calculate stability score
  const stabilityScore = calculateStabilityScore(recentPoses);
  
  // Check if poses are stable enough
  if (stabilityScore >= stabilityThreshold) {
    // Get the most recent pose as the key frame
    const keyPose = recentPoses[recentPoses.length - 1];
    
    return {
      isStable: true,
      stabilityScore,
      keyPose,
      frameCount: recentPoses.length,
      timestamp: Date.now()
    };
  }
  
  return {
    isStable: false,
    stabilityScore,
    frameCount: recentPoses.length
  };
};

/**
 * Detect action completion (pose becomes stable after movement)
 */
export const detectActionCompletion = (poseHistory, movementThreshold = 0.3, stabilityThreshold = 0.85, minFrames = 30) => {
  if (poseHistory.length < minFrames * 2) return null;
  
  // Split history into two halves
  const midPoint = Math.floor(poseHistory.length / 2);
  const earlierPoses = poseHistory.slice(0, midPoint);
  const laterPoses = poseHistory.slice(midPoint);
  
  // Check if there was movement in the earlier half
  const earlierStability = calculateStabilityScore(earlierPoses);
  const laterStability = calculateStabilityScore(laterPoses);
  
  // Action completion: low stability earlier (movement) + high stability later (stable end pose)
  if (earlierStability < movementThreshold && laterStability >= stabilityThreshold) {
    const keyPose = laterPoses[laterPoses.length - 1];
    
    return {
      actionCompleted: true,
      earlierStability,
      laterStability,
      keyPose,
      frameCount: laterPoses.length,
      timestamp: Date.now()
    };
  }
  
  return {
    actionCompleted: false,
    earlierStability,
    laterStability,
    frameCount: laterPoses.length
  };
};

/**
 * Extract key frames from pose sequence
 */
export const extractKeyFrames = (poseHistory, options = {}) => {
  const {
    stabilityThreshold = 0.85,
    movementThreshold = 0.3,
    minFrames = 30,
    maxKeyFrames = 10,
    minInterval = 1000 // 1 second between key frames
  } = options;
  
  const keyFrames = [];
  let lastKeyFrameTime = 0;
  
  // Check for stable poses
  for (let i = minFrames; i < poseHistory.length; i++) {
    const window = poseHistory.slice(i - minFrames, i);
    const stability = calculateStabilityScore(window);
    
    if (stability >= stabilityThreshold) {
      const currentTime = Date.now();
      
      // Check if enough time has passed since last key frame
      if (currentTime - lastKeyFrameTime >= minInterval) {
        const keyPose = window[window.length - 1];
        
        keyFrames.push({
          type: 'stable_pose',
          pose: keyPose,
          stability,
          frameIndex: i,
          timestamp: currentTime
        });
        
        lastKeyFrameTime = currentTime;
        
        if (keyFrames.length >= maxKeyFrames) break;
      }
    }
  }
  
  return keyFrames;
};

/**
 * Analyze pose sequence for martial arts techniques
 */
export const analyzePoseSequence = (poseHistory) => {
  if (poseHistory.length < 10) return null;
  
  const analysis = {
    totalFrames: poseHistory.length,
    averageStability: 0,
    movementDetected: false,
    stablePeriods: [],
    keyFrames: []
  };
  
  // Calculate overall stability
  analysis.averageStability = calculateStabilityScore(poseHistory);
  
  // Detect movement vs stability periods
  const windowSize = 10;
  for (let i = windowSize; i < poseHistory.length; i += windowSize) {
    const window = poseHistory.slice(i - windowSize, i);
    const stability = calculateStabilityScore(window);
    
    if (stability > 0.8) {
      analysis.stablePeriods.push({
        start: i - windowSize,
        end: i,
        stability
      });
    } else if (stability < 0.3) {
      analysis.movementDetected = true;
    }
  }
  
  // Extract key frames
  analysis.keyFrames = extractKeyFrames(poseHistory);
  
  return analysis;
};
