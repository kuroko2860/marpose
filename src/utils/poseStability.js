/**
 * Pose Stability Detection Utilities
 * Detects when poses are stable for key frame extraction
 * Also includes motion-based keyframe detection for action movements
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

/**
 * Calculate motion magnitude between two poses
 */
export const calculateMotionMagnitude = (pose1, pose2) => {
  if (!pose1.keypoints_2d || !pose2.keypoints_2d) {
    return 0;
  }
  
  const keypoints1 = pose1.keypoints_2d;
  const keypoints2 = pose2.keypoints_2d;
  
  if (keypoints1.length !== keypoints2.length) {
    return 0;
  }
  
  let totalMotion = 0;
  let validPoints = 0;
  
  for (let i = 0; i < keypoints1.length; i++) {
    const [x1, y1] = keypoints1[i];
    const [x2, y2] = keypoints2[i];
    
    // Skip invalid keypoints
    if (x1 === 0 && y1 === 0) continue;
    if (x2 === 0 && y2 === 0) continue;
    
    const motion = Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
    totalMotion += motion;
    validPoints++;
  }
  
  if (validPoints === 0) {
    return 0;
  }
  
  return totalMotion / validPoints;
};

/**
 * Detect action movements (punching, kicking, blocking)
 */
export const detectActionMovement = (poseHistory) => {
  if (poseHistory.length < 10) {
    return null;
  }
  
  const recentPoses = poseHistory.slice(-10);
  const motionMagnitudes = [];
  
  // Calculate motion between consecutive poses
  for (let i = 1; i < recentPoses.length; i++) {
    const motion = calculateMotionMagnitude(recentPoses[i-1], recentPoses[i]);
    motionMagnitudes.push(motion);
  }
  
  const avgMotion = motionMagnitudes.reduce((a, b) => a + b, 0) / motionMagnitudes.length;
  const maxMotion = Math.max(...motionMagnitudes);
  
  // Detect action based on motion patterns
  const currentPose = recentPoses[recentPoses.length - 1];
  const keypoints = currentPose.keypoints_2d || [];
  
  // Calculate joint velocities (motion in last few frames)
  const jointVelocities = {};
  for (let i = 0; i < keypoints.length; i++) {
    if (i < recentPoses.length - 1) {
      const [x1, y1] = keypoints[i];
      const [x2, y2] = recentPoses[recentPoses.length - 2].keypoints_2d[i] || [0, 0];
      
      if (x1 !== 0 && y1 !== 0 && x2 !== 0 && y2 !== 0) {
        jointVelocities[i] = Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
      }
    }
  }
  
  // Find most active joints
  const activeJoints = Object.entries(jointVelocities)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([jointIndex]) => parseInt(jointIndex));
  
  // Action detection logic
  let actionType = 'unknown';
  let confidence = 0;
  
  // Punching detection - high arm movement
  const armJoints = [5, 6, 7, 8, 9, 10]; // Shoulders, elbows, wrists
  const armActivity = activeJoints.filter(joint => armJoints.includes(joint)).length;
  const armMotion = armJoints.reduce((sum, joint) => sum + (jointVelocities[joint] || 0), 0);
  
  if (armActivity >= 2 && armMotion > 50 && maxMotion > 30) {
    actionType = 'punching';
    confidence = Math.min(0.9, (armActivity / 3) * (armMotion / 100));
  }
  
  // Kicking detection - high leg movement
  const legJoints = [11, 12, 13, 14, 15, 16]; // Hips, knees, ankles
  const legActivity = activeJoints.filter(joint => legJoints.includes(joint)).length;
  const legMotion = legJoints.reduce((sum, joint) => sum + (jointVelocities[joint] || 0), 0);
  
  if (legActivity >= 2 && legMotion > 40 && maxMotion > 25) {
    actionType = 'kicking';
    confidence = Math.min(0.9, (legActivity / 3) * (legMotion / 80));
  }
  
  // Blocking detection - moderate arm movement with stability
  if (armActivity >= 1 && armMotion > 20 && armMotion < 60 && avgMotion < 15) {
    actionType = 'blocking';
    confidence = Math.min(0.8, (armActivity / 2) * (armMotion / 50));
  }
  
  // Only return action if confidence is high enough
  if (confidence > 0.3) {
    return {
      type: actionType,
      confidence: confidence,
      motionMagnitude: avgMotion,
      peakMotion: maxMotion,
      activeJoints: activeJoints,
      timestamp: currentPose.timestamp || Date.now()
    };
  }
  
  return null;
};

/**
 * Detect action completion pattern (end of movement)
 */
export const detectActionCompletionPattern = (poseHistory) => {
  if (poseHistory.length < 15) {
    return null;
  }
  
  const recentPoses = poseHistory.slice(-15);
  const motionMagnitudes = [];
  
  // Calculate motion in sliding windows
  for (let i = 1; i < recentPoses.length; i++) {
    const motion = calculateMotionMagnitude(recentPoses[i-1], recentPoses[i]);
    motionMagnitudes.push(motion);
  }
  
  // Check for motion pattern: high -> medium -> low (action completion)
  const firstThird = motionMagnitudes.slice(0, 5);
  const middleThird = motionMagnitudes.slice(5, 10);
  const lastThird = motionMagnitudes.slice(10);
  
  const avgFirst = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
  const avgMiddle = middleThird.reduce((a, b) => a + b, 0) / middleThird.length;
  const avgLast = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;
  
  // Action completion pattern: decreasing motion
  if (avgFirst > 20 && avgMiddle > 10 && avgLast < 8) {
    const currentPose = recentPoses[recentPoses.length - 1];
    return {
      type: 'action_completion',
      confidence: Math.min(0.9, (avgFirst - avgLast) / avgFirst),
      motionPattern: { start: avgFirst, middle: avgMiddle, end: avgLast },
      timestamp: currentPose.timestamp || Date.now()
    };
  }
  
  return null;
};
