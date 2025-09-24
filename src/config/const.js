// Pose connections for MoveNet (17 keypoints)
export const POSE_CONNECTIONS = [
  // Head connections
  [0, 1], // nose to left eye
  [0, 2], // nose to right eye
  [1, 3], // left eye to left ear
  [2, 4], // right eye to right ear
  
  // Torso connections
  [5, 6], // left shoulder to right shoulder
  [5, 7], // left shoulder to left elbow
  [6, 8], // right shoulder to right elbow
  [7, 9], // left elbow to left wrist
  [8, 10], // right elbow to right wrist
  
  // Hip and leg connections
  [5, 11], // left shoulder to left hip
  [6, 12], // right shoulder to right hip
  [11, 12], // left hip to right hip
  [11, 13], // left hip to left knee
  [12, 14], // right hip to right knee
  [13, 15], // left knee to left ankle
  [14, 16], // right knee to right ankle
];

// Keypoint names for MoveNet (17 keypoints)
export const KEYPOINT_NAMES = [
  "nose",           // 0
  "left_eye",       // 1
  "right_eye",      // 2
  "left_ear",       // 3
  "right_ear",      // 4
  "left_shoulder",  // 5
  "right_shoulder", // 6
  "left_elbow",     // 7
  "right_elbow",    // 8
  "left_wrist",     // 9
  "right_wrist",    // 10
  "left_hip",       // 11
  "right_hip",      // 12
  "left_knee",      // 13
  "right_knee",     // 14
  "left_ankle",     // 15
  "right_ankle",    // 16
];

// Training types - Simplified for 2 specific poses
export const trainingTypes = [
  {
    id: "1",
    name: "Giật tay đá móc",
    description: "Defense pose with arms crossed"
  },
  {
    id: "2", 
    name: "Giật chân húc vai đẩy ngã sấp",
    description: "Defense pose holding opponent's leg"
  },
];

// Specific pose detection for training types
export const TRAINING_POSE_RULES = {
  "1": { // Arm Crossing - Based on Image 1
    name: "Giật tay đá móc 1",
    keypoints: {
      left_wrist: 9,   // left wrist
      right_wrist: 10, // right wrist
      left_elbow: 7,   // left elbow
      right_elbow: 8,  // right elbow
      left_shoulder: 5, // left shoulder
      right_shoulder: 6, // right shoulder
    },
    detection: {
      // Left arm extended (gripping opponent's arm)
      left_arm_extended: [120, 180], // degrees
      // Right arm raised (blocking position)
      right_arm_raised: [60, 120], // degrees
      // Right wrist higher than shoulder
      right_wrist_raised: true,
    },
    correct_position: {
      // One arm extended for gripping, other raised for blocking
      arm_positions: "extended_and_raised",
      // Elbows at appropriate angles
      left_elbow_angle: [120, 180], // degrees
      right_elbow_angle: [60, 120], // degrees
    }
  },
  "2": { // Holding Leg - Based on Image 2
    name: "Giật tay đá móc 2", 
    keypoints: {
      left_wrist: 9,   // left wrist
      right_wrist: 10, // right wrist
      left_elbow: 7,   // left elbow
      right_elbow: 8,  // right elbow
      left_shoulder: 5, // left shoulder
      right_shoulder: 6, // right shoulder
      left_hip: 11,    // left hip
      right_hip: 12,   // right hip
      left_knee: 13,   // left knee
      right_knee: 14,  // right knee
    },
    detection: {
      // Hands at leg level (between hip and knee)
      hands_at_leg_level: true,
      // Elbows bent for grip
      elbow_bend: [80, 140], // degrees
      // Hands close together (gripping same leg)
      hands_close: 0.4, // normalized distance
    },
    correct_position: {
      // Hands positioned to grip leg
      hands_grip: true,
      // Both arms bent for proper grip
      arm_extension: "bent_for_grip",
      // Elbows bent for proper grip
      elbow_angle: [80, 140], // degrees
    }
  }
};