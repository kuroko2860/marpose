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

// Training types
export const trainingTypes = [
  {
    id: "1",
    name: "Gậy bổ thượng",
    description: "Defense against overhead stick attack"
  },
  {
    id: "2",
    name: "Gậy vát thuận",
    description: "Defense against side stick attack"
  },
  {
    id: "3",
    name: "Dao đâm xốc",
    description: "Defense against knife thrust"
  },
  {
    id: "4",
    name: "Dao vát thuận",
    description: "Defense against knife slash"
  },
];

// Enhanced action classification rules
export const ACTION_SIGNATURES = {
  kick: {
    name: "Kick",
    description: "Leg straight and lifting, ankle close to target",
    keypoints: {
      // Leg straight and raised
      leg_straight: [11, 13, 15], // hip, knee, ankle (left leg)
      leg_straight_right: [12, 14, 16], // hip, knee, ankle (right leg)
      // Ankle position (should be high/close to target)
      ankle_high: [15, 16], // ankles
    },
    threshold: 0.5
  },
  punch: {
    name: "Punch", 
    description: "Arm straight and extended toward target",
    keypoints: {
      // Arm straight and extended
      arm_straight_left: [5, 7, 9], // shoulder, elbow, wrist (left arm)
      arm_straight_right: [6, 8, 10], // shoulder, elbow, wrist (right arm)
      // Wrist position (should be extended forward)
      wrist_extended: [9, 10], // wrists
    },
    threshold: 0.5
  },
  block: {
    name: "Block",
    description: "Arms raised up, protecting head",
    keypoints: {
      // Raised arms
      arms_raised: [7, 8, 9, 10], // elbows and wrists
      // Head protection
      head_protection: [0, 1, 2, 3, 4], // head keypoints
    },
    threshold: 0.6
  },
  dodge: {
    name: "Dodge",
    description: "Body leaning to side, arms in defensive position",
    keypoints: {
      // Body lean
      body_lean: [5, 6, 11, 12], // shoulders and hips
      // Defensive arms
      arms_defensive: [7, 8, 9, 10], // elbows and wrists
    },
    threshold: 0.6
  }
};

// Simple pose analysis rules
export const POSE_ANALYSIS_RULES = {
  block: {
    name: "Block",
    feedback: {
      good: [
        "Tuyệt vời! Tư thế chặn đúng kỹ thuật.",
        "Tay nâng cao bảo vệ đầu tốt.",
        "Tư thế chân vững chắc."
      ],
      needs_improvement: [
        "Nâng tay cao hơn để bảo vệ đầu.",
        "Giữ khoảng cách giữa hai chân ổn định.",
        "Đảm bảo tay che được mặt và đầu."
      ],
      poor: [
        "Tay quá thấp, không bảo vệ được đầu.",
        "Tư thế chân không vững.",
        "Cần cải thiện kỹ thuật chặn."
      ]
    }
  },
  dodge: {
    name: "Dodge",
    feedback: {
      good: [
        "Tuyệt vời! Né đòn đúng kỹ thuật.",
        "Tư thế cơ thể nghiêng phù hợp.",
        "Chân ở vị trí sẵn sàng di chuyển."
      ],
      needs_improvement: [
        "Nghiêng cơ thể nhiều hơn để né đòn.",
        "Điều chỉnh vị trí chân để dễ di chuyển.",
        "Giữ tay ở tư thế phòng thủ."
      ],
      poor: [
        "Tư thế cơ thể không phù hợp để né đòn.",
        "Chân quá gần nhau, khó di chuyển.",
        "Cần cải thiện kỹ thuật né đòn."
      ]
    }
  }
};

// Calculate angle between three points
export const calculateAngle = (point1, point2, point3) => {
  const vector1 = {
    x: point1.x - point2.x,
    y: point1.y - point2.y
  };
  const vector2 = {
    x: point3.x - point2.x,
    y: point3.y - point2.y
  };
  
  const dot = vector1.x * vector2.x + vector1.y * vector2.y;
  const mag1 = Math.sqrt(vector1.x * vector1.x + vector1.y * vector1.y);
  const mag2 = Math.sqrt(vector2.x * vector2.x + vector2.y * vector2.y);
  
  const angle = Math.acos(dot / (mag1 * mag2)) * (180 / Math.PI);
  return angle;
};

// Calculate distance between two points
export const calculateDistance = (point1, point2) => {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

// Classify action based on pose
export const classifyAction = (keypoints) => {
  if (!keypoints || keypoints.length < 17) {
    return { action: "unknown", confidence: 0 };
  }

  let bestAction = "unknown";
  let bestScore = 0;

  // Check kick: leg straight and lifting, ankle close to target
  const kickScore = checkKick(keypoints);
  if (kickScore > bestScore && kickScore >= ACTION_SIGNATURES.kick.threshold) {
    bestScore = kickScore;
    bestAction = "kick";
  }

  // Check punch: arm straight and extended toward target
  const punchScore = checkPunch(keypoints);
  if (punchScore > bestScore && punchScore >= ACTION_SIGNATURES.punch.threshold) {
    bestScore = punchScore;
    bestAction = "punch";
  }

  // Check block: arms raised up, protecting head
  const blockScore = checkBlock(keypoints);
  if (blockScore > bestScore && blockScore >= ACTION_SIGNATURES.block.threshold) {
    bestScore = blockScore;
    bestAction = "block";
  }

  // Check dodge: body leaning to side
  const dodgeScore = checkDodge(keypoints);
  if (dodgeScore > bestScore && dodgeScore >= ACTION_SIGNATURES.dodge.threshold) {
    bestScore = dodgeScore;
    bestAction = "dodge";
  }

  return {
    action: bestAction,
    confidence: bestScore
  };
};

// Check for kick: leg straight and lifting
const checkKick = (keypoints) => {
  let maxKickScore = 0;

  // Check left leg
  const leftHip = keypoints[11];
  const leftKnee = keypoints[13];
  const leftAnkle = keypoints[15];

  if (leftHip.score > MIN_SCORE && leftKnee.score > MIN_SCORE && leftAnkle.score > MIN_SCORE) {
    // Check if leg is straight (knee angle close to 180 degrees)
    const leftLegAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
    const leftLegStraightness = Math.abs(leftLegAngle - 180) / 180; // 0 = perfectly straight
    
    // Check if ankle is higher than knee (lifting)
    const leftLifting = leftAnkle.y < leftKnee.y ? 1 : 0;
    
    // Check if ankle is close to body center (target proximity)
    const bodyCenter = { x: (keypoints[5].x + keypoints[6].x) / 2, y: (keypoints[5].y + keypoints[6].y) / 2 };
    const leftDistance = calculateDistance(leftAnkle, bodyCenter);
    const leftProximity = Math.max(0, 1 - leftDistance / 200); // Closer = higher score
    
    const leftKickScore = (leftLegStraightness + leftLifting + leftProximity) / 3;
    maxKickScore = Math.max(maxKickScore, leftKickScore);
  }

  // Check right leg
  const rightHip = keypoints[12];
  const rightKnee = keypoints[14];
  const rightAnkle = keypoints[16];

  if (rightHip.score > MIN_SCORE && rightKnee.score > MIN_SCORE && rightAnkle.score > MIN_SCORE) {
    // Check if leg is straight
    const rightLegAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
    const rightLegStraightness = Math.abs(rightLegAngle - 180) / 180;
    
    // Check if ankle is higher than knee (lifting)
    const rightLifting = rightAnkle.y < rightKnee.y ? 1 : 0;
    
    // Check if ankle is close to body center
    const bodyCenter = { x: (keypoints[5].x + keypoints[6].x) / 2, y: (keypoints[5].y + keypoints[6].y) / 2 };
    const rightDistance = calculateDistance(rightAnkle, bodyCenter);
    const rightProximity = Math.max(0, 1 - rightDistance / 200);
    
    const rightKickScore = (rightLegStraightness + rightLifting + rightProximity) / 3;
    maxKickScore = Math.max(maxKickScore, rightKickScore);
  }

  return maxKickScore;
};

// Check for punch: arm straight and extended toward target
const checkPunch = (keypoints) => {
  let maxPunchScore = 0;

  // Check left arm
  const leftShoulder = keypoints[5];
  const leftElbow = keypoints[7];
  const leftWrist = keypoints[9];

  if (leftShoulder.score > MIN_SCORE && leftElbow.score > MIN_SCORE && leftWrist.score > MIN_SCORE) {
    // Check if arm is straight (elbow angle close to 180 degrees)
    const leftArmAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
    const leftArmStraightness = Math.abs(leftArmAngle - 180) / 180;
    
    // Check if wrist is extended forward (away from body)
    const leftExtension = leftWrist.x > leftShoulder.x ? 1 : 0;
    
    // Check if wrist is close to head/shoulder level
    const headY = keypoints[0].y; // nose
    const leftHeightMatch = Math.abs(leftWrist.y - headY) < 100 ? 1 : 0;
    
    const leftPunchScore = (leftArmStraightness + leftExtension + leftHeightMatch) / 3;
    maxPunchScore = Math.max(maxPunchScore, leftPunchScore);
  }

  // Check right arm
  const rightShoulder = keypoints[6];
  const rightElbow = keypoints[8];
  const rightWrist = keypoints[10];

  if (rightShoulder.score > MIN_SCORE && rightElbow.score > MIN_SCORE && rightWrist.score > MIN_SCORE) {
    // Check if arm is straight
    const rightArmAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
    const rightArmStraightness = Math.abs(rightArmAngle - 180) / 180;
    
    // Check if wrist is extended forward
    const rightExtension = rightWrist.x > rightShoulder.x ? 1 : 0;
    
    // Check if wrist is close to head/shoulder level
    const headY = keypoints[0].y; // nose
    const rightHeightMatch = Math.abs(rightWrist.y - headY) < 100 ? 1 : 0;
    
    const rightPunchScore = (rightArmStraightness + rightExtension + rightHeightMatch) / 3;
    maxPunchScore = Math.max(maxPunchScore, rightPunchScore);
  }

  return maxPunchScore;
};

// Check for block: arms raised up, protecting head
const checkBlock = (keypoints) => {
  let blockScore = 0;
  let validChecks = 0;

  // Check if arms are raised (wrists above shoulders)
  const leftShoulder = keypoints[5];
  const rightShoulder = keypoints[6];
  const leftWrist = keypoints[9];
  const rightWrist = keypoints[10];

  if (leftShoulder.score > MIN_SCORE && leftWrist.score > MIN_SCORE) {
    const leftRaised = leftWrist.y < leftShoulder.y ? 1 : 0;
    blockScore += leftRaised;
    validChecks++;
  }

  if (rightShoulder.score > MIN_SCORE && rightWrist.score > MIN_SCORE) {
    const rightRaised = rightWrist.y < rightShoulder.y ? 1 : 0;
    blockScore += rightRaised;
    validChecks++;
  }

  return validChecks > 0 ? blockScore / validChecks : 0;
};

// Check for dodge: body leaning to side
const checkDodge = (keypoints) => {
  const leftShoulder = keypoints[5];
  const rightShoulder = keypoints[6];
  const leftHip = keypoints[11];
  const rightHip = keypoints[12];

  if (leftShoulder.score > MIN_SCORE && rightShoulder.score > MIN_SCORE && 
      leftHip.score > MIN_SCORE && rightHip.score > MIN_SCORE) {
    
    // Check if body is leaning (shoulders and hips not aligned)
    const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
    const hipDiff = Math.abs(leftHip.y - rightHip.y);
    
    const leanScore = (shoulderDiff + hipDiff) / 200; // Normalize
    return Math.min(leanScore, 1);
  }

  return 0;
};

// Simple pose analysis for defender
export const analyzePose = (keypoints, action) => {
  if (!keypoints || keypoints.length < 17) {
    return {
      score: 0,
      feedback: "Không thể phân tích tư thế. Thiếu keypoints.",
      details: []
    };
  }

  const rules = POSE_ANALYSIS_RULES[action];
  if (!rules) {
    return {
      score: 0,
      feedback: "Không tìm thấy quy tắc phân tích cho hành động này.",
      details: []
    };
  }

  // Simple scoring based on keypoint confidence
  let totalScore = 0;
  let validKeypoints = 0;

  keypoints.forEach(kp => {
    if (kp.score >MIN_SCORE) {
      totalScore += kp.score;
      validKeypoints++;
    }
  });

  const finalScore = validKeypoints > 0 ? totalScore / validKeypoints : 0;
  
  // Determine feedback based on score
  let feedback;
  if (finalScore >= 0.8) {
    feedback = rules.feedback.good[Math.floor(Math.random() * rules.feedback.good.length)];
  } else if (finalScore >= 0.5) {
    feedback = rules.feedback.needs_improvement[Math.floor(Math.random() * rules.feedback.needs_improvement.length)];
  } else {
    feedback = rules.feedback.poor[Math.floor(Math.random() * rules.feedback.poor.length)];
  }

  return {
    score: finalScore,
    feedback: feedback,
    details: [`Điểm tin cậy keypoints: ${Math.round(finalScore * 100)}%`],
    action: action
  };
};

export const MIN_SCORE = 0.2