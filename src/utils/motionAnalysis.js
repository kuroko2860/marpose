/**
 * Motion Analysis Utilities for Pose Skeleton Data
 * Analyzes human motion from sequences of pose keypoints
 */

// Calculate distance between two points
const calculateDistance = (point1, point2) => {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

// Calculate angle between three points (in degrees)
const calculateAngle = (point1, point2, point3) => {
  const a = calculateDistance(point2, point3);
  const b = calculateDistance(point1, point3);
  const c = calculateDistance(point1, point2);
  
  if (a === 0 || b === 0 || c === 0) return 0;
  
  const angle = Math.acos((a * a + c * c - b * b) / (2 * a * c));
  return (angle * 180) / Math.PI;
};

// Calculate velocity between two poses
const calculateVelocity = (pose1, pose2, timeDiff) => {
  if (!pose1 || !pose2 || timeDiff === 0) return null;
  
  const velocities = {};
  const keypoints1 = pose1.keypoints_2d || pose1.keypoints || [];
  const keypoints2 = pose2.keypoints_2d || pose2.keypoints || [];
  
  keypoints1.forEach((kp1, index) => {
    const kp2 = keypoints2[index];
    if (kp1 && kp2 && kp1.x && kp1.y && kp2.x && kp2.y) {
      const dx = kp2.x - kp1.x;
      const dy = kp2.y - kp1.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      velocities[index] = distance / timeDiff; // pixels per second
    }
  });
  
  return velocities;
};

// Calculate acceleration between three poses
const calculateAcceleration = (pose1, pose2, pose3, timeDiff) => {
  if (!pose1 || !pose2 || !pose3 || timeDiff === 0) return null;
  
  const v1 = calculateVelocity(pose1, pose2, timeDiff);
  const v2 = calculateVelocity(pose2, pose3, timeDiff);
  
  if (!v1 || !v2) return null;
  
  const accelerations = {};
  Object.keys(v1).forEach(key => {
    if (v2[key] !== undefined) {
      accelerations[key] = (v2[key] - v1[key]) / timeDiff;
    }
  });
  
  return accelerations;
};

// Extract kinematic features from pose sequence
export const extractKinematicFeatures = (poseSequence) => {
  if (!poseSequence || poseSequence.length < 2) return null;
  
  const features = {
    jointAngles: [],
    velocities: [],
    accelerations: [],
    jointDistances: [],
    motionMagnitude: [],
    stability: []
  };
  
  for (let i = 0; i < poseSequence.length; i++) {
    const currentPose = poseSequence[i];
    const keypoints = currentPose.keypoints_2d || currentPose.keypoints || [];
    
    // Calculate joint angles for key joints
    const angles = {};
    if (keypoints.length >= 17) { // Assuming COCO format
      // Elbow angles
      if (keypoints[5] && keypoints[6] && keypoints[7]) {
        angles.leftElbow = calculateAngle(keypoints[5], keypoints[6], keypoints[7]);
      }
      if (keypoints[2] && keypoints[3] && keypoints[4]) {
        angles.rightElbow = calculateAngle(keypoints[2], keypoints[3], keypoints[4]);
      }
      
      // Knee angles
      if (keypoints[11] && keypoints[12] && keypoints[13]) {
        angles.leftKnee = calculateAngle(keypoints[11], keypoints[12], keypoints[13]);
      }
      if (keypoints[8] && keypoints[9] && keypoints[10]) {
        angles.rightKnee = calculateAngle(keypoints[8], keypoints[9], keypoints[10]);
      }
      
      // Hip angles
      if (keypoints[5] && keypoints[11] && keypoints[12]) {
        angles.leftHip = calculateAngle(keypoints[5], keypoints[11], keypoints[12]);
      }
      if (keypoints[2] && keypoints[8] && keypoints[9]) {
        angles.rightHip = calculateAngle(keypoints[2], keypoints[8], keypoints[9]);
      }
    }
    
    features.jointAngles.push(angles);
    
    // Calculate velocities and accelerations
    if (i > 0) {
      const timeDiff = (currentPose.timestamp - poseSequence[i-1].timestamp) / 1000; // Convert to seconds
      const velocity = calculateVelocity(poseSequence[i-1], currentPose, timeDiff);
      features.velocities.push(velocity);
      
      if (i > 1) {
        const acceleration = calculateAcceleration(
          poseSequence[i-2], 
          poseSequence[i-1], 
          currentPose, 
          timeDiff
        );
        features.accelerations.push(acceleration);
      }
    }
    
    // Calculate joint distances
    const distances = {};
    if (keypoints.length >= 2) {
      // Distance between shoulders
      if (keypoints[5] && keypoints[2]) {
        distances.shoulderWidth = calculateDistance(keypoints[5], keypoints[2]);
      }
      // Distance between hips
      if (keypoints[11] && keypoints[8]) {
        distances.hipWidth = calculateDistance(keypoints[11], keypoints[8]);
      }
      // Height (head to feet)
      if (keypoints[0] && keypoints[15]) {
        distances.height = calculateDistance(keypoints[0], keypoints[15]);
      }
    }
    features.jointDistances.push(distances);
    
    // Calculate motion magnitude
    if (i > 0) {
      const prevPose = poseSequence[i-1];
      const prevKeypoints = prevPose.keypoints_2d || prevPose.keypoints || [];
      let totalMovement = 0;
      let validPoints = 0;
      
      keypoints.forEach((kp, index) => {
        const prevKp = prevKeypoints[index];
        if (kp && prevKp && kp.x && kp.y && prevKp.x && prevKp.y) {
          totalMovement += calculateDistance(kp, prevKp);
          validPoints++;
        }
      });
      
      features.motionMagnitude.push(validPoints > 0 ? totalMovement / validPoints : 0);
    }
  }
  
  return features;
};

// Analyze motion patterns
export const analyzeMotionPatterns = (kinematicFeatures) => {
  if (!kinematicFeatures) return null;
  
  const analysis = {
    motionType: 'unknown',
    intensity: 'low',
    smoothness: 'unknown',
    symmetry: 'unknown',
    stability: 'unknown',
    dominantJoints: [],
    motionMetrics: {}
  };
  
  // Analyze motion intensity
  const avgMotionMagnitude = kinematicFeatures.motionMagnitude.reduce((a, b) => a + b, 0) / kinematicFeatures.motionMagnitude.length;
  if (avgMotionMagnitude > 10) {
    analysis.intensity = 'high';
  } else if (avgMotionMagnitude > 5) {
    analysis.intensity = 'medium';
  }
  
  // Analyze motion smoothness (lower variance = smoother)
  const motionVariance = calculateVariance(kinematicFeatures.motionMagnitude);
  if (motionVariance < 2) {
    analysis.smoothness = 'smooth';
  } else if (motionVariance < 5) {
    analysis.smoothness = 'moderate';
  } else {
    analysis.smoothness = 'jerky';
  }
  
  // Analyze symmetry (compare left vs right joint movements)
  if (kinematicFeatures.jointAngles.length > 0) {
    const leftElbowAngles = kinematicFeatures.jointAngles.map(a => a.leftElbow || 0);
    const rightElbowAngles = kinematicFeatures.jointAngles.map(a => a.rightElbow || 0);
    const leftKneeAngles = kinematicFeatures.jointAngles.map(a => a.leftKnee || 0);
    const rightKneeAngles = kinematicFeatures.jointAngles.map(a => a.rightKnee || 0);
    
    const elbowSymmetry = calculateSymmetry(leftElbowAngles, rightElbowAngles);
    const kneeSymmetry = calculateSymmetry(leftKneeAngles, rightKneeAngles);
    
    if (elbowSymmetry > 0.8 && kneeSymmetry > 0.8) {
      analysis.symmetry = 'symmetric';
    } else if (elbowSymmetry > 0.6 && kneeSymmetry > 0.6) {
      analysis.symmetry = 'moderately_symmetric';
    } else {
      analysis.symmetry = 'asymmetric';
    }
  }
  
  // Analyze stability (lower movement variance = more stable)
  const stabilityScore = 1 - Math.min(motionVariance / 10, 1);
  if (stabilityScore > 0.8) {
    analysis.stability = 'stable';
  } else if (stabilityScore > 0.5) {
    analysis.stability = 'moderately_stable';
  } else {
    analysis.stability = 'unstable';
  }
  
  // Identify dominant joints (most movement)
  const jointMovements = {};
  kinematicFeatures.velocities.forEach(velocity => {
    Object.keys(velocity).forEach(jointIndex => {
      if (!jointMovements[jointIndex]) jointMovements[jointIndex] = 0;
      jointMovements[jointIndex] += velocity[jointIndex];
    });
  });
  
  analysis.dominantJoints = Object.entries(jointMovements)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([jointIndex]) => parseInt(jointIndex));
  
  // Calculate motion metrics
  analysis.motionMetrics = {
    averageMotionMagnitude: avgMotionMagnitude,
    motionVariance: motionVariance,
    stabilityScore: stabilityScore,
    totalFrames: kinematicFeatures.motionMagnitude.length,
    averageVelocity: calculateAverageVelocity(kinematicFeatures.velocities),
    peakVelocity: calculatePeakVelocity(kinematicFeatures.velocities)
  };
  
  return analysis;
};

// Classify motion type based on patterns
export const classifyMotionType = (motionAnalysis, kinematicFeatures, keyframeType = null) => {
  if (!motionAnalysis || !kinematicFeatures) return 'unknown';
  
  const { intensity, symmetry, stability, dominantJoints } = motionAnalysis;
  const { averageMotionMagnitude, motionVariance, peakVelocity } = motionAnalysis.motionMetrics;
  
  // If we have a keyframe type from action detection, use it as a strong hint
  if (keyframeType && ['punching', 'kicking', 'blocking', 'action_completion'].includes(keyframeType)) {
    console.log('Using keyframe type as motion hint:', keyframeType);
    // Boost the score for the detected action type
    if (keyframeType === 'punching' || keyframeType === 'kicking' || keyframeType === 'blocking') {
      return keyframeType; // Direct match
    } else if (keyframeType === 'action_completion') {
      // For action completion, we need to analyze the motion pattern
      // This will fall through to the normal classification
    }
  }
  
  // Enhanced martial arts specific classification
  const scores = {
    punching: 0,
    kicking: 0,
    blocking: 0,
    stance: 0,
    walking: 0,
    static_pose: 0,
    general_movement: 0
  };
  
  // Punching detection - focus on arm movement
  if (dominantJoints.includes(5) || dominantJoints.includes(6)) { // Left/Right Shoulder
    scores.punching += 3;
  }
  if (dominantJoints.includes(7) || dominantJoints.includes(8)) { // Left/Right Elbow
    scores.punching += 4;
  }
  if (dominantJoints.includes(9) || dominantJoints.includes(10)) { // Left/Right Wrist
    scores.punching += 5;
  }
  if (intensity === 'high' && peakVelocity > 50) {
    scores.punching += 2;
  }
  if (motionVariance > 8 && averageMotionMagnitude > 3) {
    scores.punching += 2;
  }
  
  // Kicking detection - focus on leg movement
  if (dominantJoints.includes(11) || dominantJoints.includes(12)) { // Left/Right Hip
    scores.kicking += 3;
  }
  if (dominantJoints.includes(13) || dominantJoints.includes(14)) { // Left/Right Knee
    scores.kicking += 4;
  }
  if (dominantJoints.includes(15) || dominantJoints.includes(16)) { // Left/Right Ankle
    scores.kicking += 5;
  }
  if (intensity === 'high' && peakVelocity > 40) {
    scores.kicking += 2;
  }
  if (motionVariance > 6 && averageMotionMagnitude > 2.5) {
    scores.kicking += 2;
  }
  
  // Blocking detection - defensive arm movements
  if (dominantJoints.includes(5) || dominantJoints.includes(6)) { // Shoulders
    scores.blocking += 2;
  }
  if (dominantJoints.includes(7) || dominantJoints.includes(8)) { // Elbows
    scores.blocking += 3;
  }
  if (intensity === 'medium' && stability === 'moderately_stable') {
    scores.blocking += 2;
  }
  if (motionVariance > 3 && motionVariance < 8) {
    scores.blocking += 1;
  }
  
  // Stance detection - stable, low movement
  if (intensity === 'low' && stability === 'stable') {
    scores.stance += 4;
  }
  if (motionVariance < 3 && averageMotionMagnitude < 1.5) {
    scores.stance += 3;
  }
  if (peakVelocity < 20) {
    scores.stance += 2;
  }
  
  // Walking detection - symmetric, medium movement
  if (symmetry === 'symmetric' && intensity === 'medium') {
    scores.walking += 3;
  }
  if (dominantJoints.includes(11) || dominantJoints.includes(12) || 
      dominantJoints.includes(13) || dominantJoints.includes(14)) {
    scores.walking += 2;
  }
  if (motionVariance > 2 && motionVariance < 6) {
    scores.walking += 1;
  }
  
  // Static pose detection - very low movement
  if (motionVariance < 1.5 && stability === 'stable' && peakVelocity < 10) {
    scores.static_pose += 4;
  }
  if (intensity === 'low' && averageMotionMagnitude < 1) {
    scores.static_pose += 2;
  }
  
  // General movement - fallback
  if (intensity === 'high' || motionVariance > 10) {
    scores.general_movement += 2;
  }
  
  // Find the motion type with highest score
  const maxScore = Math.max(...Object.values(scores));
  const detectedMotion = Object.keys(scores).find(key => scores[key] === maxScore);
  
  // Debug logging
  console.log('Motion Detection Scores:', scores);
  console.log('Detected Motion:', detectedMotion, 'Score:', maxScore);
  console.log('Motion Metrics:', { averageMotionMagnitude, motionVariance, peakVelocity });
  console.log('Dominant Joints:', dominantJoints);
  console.log('Motion Analysis Input:', { intensity, symmetry, stability });
  
  // Only return the detected motion if it has a significant score
  if (maxScore >= 3) {
    return detectedMotion;
  }
  
  // Default to general_movement if no clear pattern
  return 'general_movement';
};

// Helper functions
const calculateVariance = (values) => {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
};

const calculateSymmetry = (leftValues, rightValues) => {
  if (leftValues.length !== rightValues.length) return 0;
  
  let correlation = 0;
  const n = leftValues.length;
  
  for (let i = 0; i < n; i++) {
    correlation += (leftValues[i] - rightValues[i]) ** 2;
  }
  
  const maxDiff = Math.max(...leftValues) - Math.min(...leftValues);
  return maxDiff > 0 ? 1 - (correlation / n) / (maxDiff ** 2) : 1;
};

const calculateAverageVelocity = (velocities) => {
  if (!velocities || velocities.length === 0) return 0;
  
  let totalVelocity = 0;
  let count = 0;
  
  velocities.forEach(velocity => {
    Object.values(velocity).forEach(v => {
      totalVelocity += v;
      count++;
    });
  });
  
  return count > 0 ? totalVelocity / count : 0;
};

const calculatePeakVelocity = (velocities) => {
  if (!velocities || velocities.length === 0) return 0;
  
  let peak = 0;
  velocities.forEach(velocity => {
    Object.values(velocity).forEach(v => {
      peak = Math.max(peak, v);
    });
  });
  
  return peak;
};

// Main motion analysis function
export const analyzeMotion = (poseSequence, keyframeType = null) => {
  if (!poseSequence || poseSequence.length < 2) {
    return {
      error: 'Insufficient pose data for motion analysis',
      features: null,
      patterns: null,
      motionType: 'unknown'
    };
  }
  
  try {
    // Extract kinematic features
    const features = extractKinematicFeatures(poseSequence);
    
    // Analyze motion patterns
    const patterns = analyzeMotionPatterns(features);
    
    // Classify motion type (pass keyframe type for better accuracy)
    const motionType = classifyMotionType(patterns, features, keyframeType);
    
    return {
      features,
      patterns,
      motionType,
      confidence: calculateMotionConfidence(patterns, features),
      recommendations: generateRecommendations(patterns, motionType)
    };
  } catch (error) {
    return {
      error: `Motion analysis failed: ${error.message}`,
      features: null,
      patterns: null,
      motionType: 'unknown'
    };
  }
};

// Calculate confidence score for motion analysis
const calculateMotionConfidence = (patterns, features) => {
  if (!patterns || !features) return 0;
  
  let confidence = 0.5; // Base confidence
  
  // Increase confidence based on data quality
  if (features.motionMagnitude.length > 10) confidence += 0.2;
  if (features.velocities.length > 5) confidence += 0.2;
  if (patterns.motionMetrics.averageMotionMagnitude > 1) confidence += 0.1;
  
  return Math.min(confidence, 1.0);
};

// Generate recommendations based on analysis
const generateRecommendations = (patterns, motionType) => {
  const recommendations = [];
  
  if (patterns.intensity === 'low' && motionType !== 'stance') {
    recommendations.push('Nên tăng cường độ chuyển động để tập luyện tốt hơn');
  }
  
  if (patterns.symmetry === 'asymmetric') {
    recommendations.push('Tập trung vào chuyển động đối xứng để cải thiện thăng bằng');
  }
  
  if (patterns.stability === 'unstable') {
    recommendations.push('Luyện tập ổn định và kiểm soát trong chuyển động');
  }
  
  if (patterns.smoothness === 'jerky') {
    recommendations.push('Thực hành chuyển động mượt mà và có kiểm soát hơn');
  }
  
  return recommendations;
};

export default {
  analyzeMotion,
  extractKinematicFeatures,
  analyzeMotionPatterns,
  classifyMotionType
};
