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

 // Mock training types
export const trainingTypes = [
  {
    id: "1",
    name: "Gậy bổ thượng",
  },
  {
    id: "2",
    name: "Gậy vát thuận",
  },
  {
    id: "3",
    name: "Dao đâm xốc",
  },
  {
    id: "4",
    name: "Dao vát thuận",
  },
];

export const MIN_SCORE = 0.2