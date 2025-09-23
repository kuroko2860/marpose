/**
 * Training Pose Detection Utilities
 * Detects specific poses for martial arts training types
 */

import { TRAINING_POSE_RULES } from '../config/const';

/**
 * Calculate distance between two keypoints
 */
const calculateDistance = (kp1, kp2) => {
  if (!kp1 || !kp2 || kp1.length < 2 || kp2.length < 2) return Infinity;
  const dx = kp1[0] - kp2[0];
  const dy = kp1[1] - kp2[1];
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Calculate angle between three keypoints
 */
const calculateAngle = (kp1, kp2, kp3) => {
  if (!kp1 || !kp2 || !kp3) return 0;
  
  const a = calculateDistance(kp2, kp3);
  const b = calculateDistance(kp1, kp3);
  const c = calculateDistance(kp1, kp2);
  
  if (a === 0 || b === 0 || c === 0) return 0;
  
  const angle = Math.acos((a * a + c * c - b * b) / (2 * a * c));
  return (angle * 180) / Math.PI;
};

/**
 * Detect Arm Crossing pose (Training Type 1) - Based on Image 1
 * The pose shows gripping opponent's forearm with one hand, other arm raised for blocking
 */
export const detectArmCrossing = (pose) => {
  if (!pose || !pose.keypoints_2d) return null;
  
  const keypoints = pose.keypoints_2d;
  const rules = TRAINING_POSE_RULES["1"];
  
  // Get keypoint positions
  const leftWrist = keypoints[rules.keypoints.left_wrist];
  const rightWrist = keypoints[rules.keypoints.right_wrist];
  const leftElbow = keypoints[rules.keypoints.left_elbow];
  const rightElbow = keypoints[rules.keypoints.right_elbow];
  const leftShoulder = keypoints[rules.keypoints.left_shoulder];
  const rightShoulder = keypoints[rules.keypoints.right_shoulder];
  
  // Skip if any keypoints are missing
  if (!leftWrist || !rightWrist || !leftElbow || !rightElbow || 
      !leftShoulder || !rightShoulder) {
    return null;
  }
  
  // Calculate metrics
  const leftElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
  const rightElbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
  
  // Check if one arm is extended (gripping) and other is raised (blocking)
  const leftArmExtended = leftElbowAngle > 120 && leftElbowAngle < 180; // More straight
  const rightArmRaised = rightElbowAngle > 60 && rightElbowAngle < 120; // More bent, raised
  
  // Check if right wrist is higher than right shoulder (blocking position)
  const rightWristRaised = rightWrist[1] < rightShoulder[1];
  
  // Check if left wrist is at appropriate height (gripping position)
  const leftWristAtGripHeight = leftWrist[1] > leftShoulder[1] && leftWrist[1] < leftElbow[1];
  
  // Calculate confidence
  let confidence = 0;
  if (leftArmExtended) confidence += 0.3;
  if (rightArmRaised) confidence += 0.3;
  if (rightWristRaised) confidence += 0.2;
  if (leftWristAtGripHeight) confidence += 0.2;
  
  // Check if pose is correct
  const isCorrect = leftArmExtended && rightArmRaised && rightWristRaised && confidence > 0.7;
  
  return {
    type: 'arm_crossing',
    confidence: Math.min(confidence, 1.0),
    isCorrect: isCorrect,
    metrics: {
      leftElbowAngle: leftElbowAngle,
      rightElbowAngle: rightElbowAngle,
      leftArmExtended: leftArmExtended,
      rightArmRaised: rightArmRaised,
      rightWristRaised: rightWristRaised,
      leftWristAtGripHeight: leftWristAtGripHeight
    },
    feedback: {
      leftArmExtended: leftArmExtended ? "✅ Tay trái duỗi đúng (nắm tay đối thủ)" : "❌ Tay trái cần duỗi thẳng hơn",
      rightArmRaised: rightArmRaised ? "✅ Tay phải nâng đúng (tư thế chặn)" : "❌ Tay phải cần nâng cao hơn",
      rightWristRaised: rightWristRaised ? "✅ Cổ tay phải ở vị trí chặn đúng" : "❌ Cổ tay phải cần nâng cao hơn",
      overall: isCorrect ? "✅ Tư thế khoanh tay đúng" : "❌ Cần điều chỉnh tư thế"
    }
  };
};

/**
 * Detect Holding Leg pose (Training Type 2) - Based on Image 2
 * The pose shows gripping/holding opponent's leg with both hands
 */
export const detectHoldingLeg = (pose) => {
  if (!pose || !pose.keypoints_2d) return null;
  
  const keypoints = pose.keypoints_2d;
  const rules = TRAINING_POSE_RULES["2"];
  
  // Get keypoint positions
  const leftWrist = keypoints[rules.keypoints.left_wrist];
  const rightWrist = keypoints[rules.keypoints.right_wrist];
  const leftElbow = keypoints[rules.keypoints.left_elbow];
  const rightElbow = keypoints[rules.keypoints.right_elbow];
  const leftHip = keypoints[rules.keypoints.left_hip];
  const rightHip = keypoints[rules.keypoints.right_hip];
  const leftKnee = keypoints[rules.keypoints.left_knee];
  const rightKnee = keypoints[rules.keypoints.right_knee];
  
  // Get shoulder positions for angle calculation
  const leftShoulder = keypoints[rules.keypoints.left_shoulder];
  const rightShoulder = keypoints[rules.keypoints.right_shoulder];
  
  // Skip if any keypoints are missing
  if (!leftWrist || !rightWrist || !leftElbow || !rightElbow || 
      !leftHip || !rightHip || !leftKnee || !rightKnee ||
      !leftShoulder || !rightShoulder) {
    return null;
  }
  
  // Calculate metrics
  const leftElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
  const rightElbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
  
  // Check if hands are positioned at leg level (between hip and knee)
  const leftWristHeight = leftWrist[1];
  const rightWristHeight = rightWrist[1];
  const leftHipHeight = leftHip[1];
  const rightHipHeight = rightHip[1];
  const leftKneeHeight = leftKnee[1];
  const rightKneeHeight = rightKnee[1];
  
  const leftHandAtLegLevel = leftWristHeight > leftHipHeight && leftWristHeight < leftKneeHeight;
  const rightHandAtLegLevel = rightWristHeight > rightHipHeight && rightWristHeight < rightKneeHeight;
  const handsAtLegLevel = leftHandAtLegLevel && rightHandAtLegLevel;
  
  // Check if elbows are bent for proper grip (both arms should be bent)
  const leftElbowBent = leftElbowAngle > 80 && leftElbowAngle < 140;
  const rightElbowBent = rightElbowAngle > 80 && rightElbowAngle < 140;
  const elbowsBent = leftElbowBent && rightElbowBent;
  
  // Check if hands are close together (gripping the same leg)
  const handDistance = calculateDistance(leftWrist, rightWrist);
  const shoulderDistance = calculateDistance(leftShoulder, rightShoulder);
  const normalizedHandDistance = handDistance / shoulderDistance;
  const handsCloseTogether = normalizedHandDistance < 0.4; // Hands should be close
  
  // Check if hands are positioned forward (extending from body)
  const leftWristForward = leftWrist[0] > leftHip[0] - 30; // Wrist should be forward of hip
  const rightWristForward = rightWrist[0] < rightHip[0] + 30; // Wrist should be forward of hip
  const handsForward = leftWristForward && rightWristForward;
  
  // Calculate confidence
  let confidence = 0;
  if (handsAtLegLevel) confidence += 0.3;
  if (elbowsBent) confidence += 0.3;
  if (handsCloseTogether) confidence += 0.2;
  if (handsForward) confidence += 0.2;
  
  // Check if pose is correct
  const isCorrect = handsAtLegLevel && elbowsBent && handsCloseTogether && confidence > 0.7;
  
  return {
    type: 'holding_leg',
    confidence: Math.min(confidence, 1.0),
    isCorrect: isCorrect,
    metrics: {
      leftElbowAngle: leftElbowAngle,
      rightElbowAngle: rightElbowAngle,
      handsAtLegLevel: handsAtLegLevel,
      elbowsBent: elbowsBent,
      handsCloseTogether: handsCloseTogether,
      handsForward: handsForward,
      normalizedHandDistance: normalizedHandDistance
    },
    feedback: {
      handsAtLegLevel: handsAtLegLevel ? "✅ Tay ở vị trí chân đúng" : "❌ Tay cần hạ xuống vị trí chân",
      elbowsBent: elbowsBent ? "✅ Khuỷu tay cong đúng để nắm chân" : "❌ Khuỷu tay cần cong hơn",
      handsCloseTogether: handsCloseTogether ? "✅ Hai tay nắm chân gần nhau đúng" : "❌ Hai tay cần nắm chân gần nhau hơn",
      handsForward: handsForward ? "✅ Tay duỗi ra trước đúng" : "❌ Tay cần duỗi ra trước hơn",
      overall: isCorrect ? "✅ Tư thế giữ chân đúng" : "❌ Cần điều chỉnh tư thế"
    }
  };
};

/**
 * Detect training pose based on training type
 */
export const detectTrainingPose = (pose, trainingTypeId) => {
  if (!pose || !trainingTypeId) return null;
  
  switch (trainingTypeId) {
    case "1":
      return detectArmCrossing(pose);
    case "2":
      return detectHoldingLeg(pose);
    default:
      return null;
  }
};

/**
 * Analyze pose correctness and provide feedback
 */
export const analyzePoseCorrectness = (pose, trainingTypeId) => {
  const detection = detectTrainingPose(pose, trainingTypeId);
  
  if (!detection) {
    return {
      detected: false,
      confidence: 0,
      isCorrect: false,
      feedback: {
        overall: "❌ Không phát hiện được tư thế"
      }
    };
  }
  
  return {
    detected: true,
    confidence: detection.confidence,
    isCorrect: detection.isCorrect,
    feedback: detection.feedback,
    metrics: detection.metrics
  };
};
