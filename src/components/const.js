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

// Simple action classification rules
export const ACTION_SIGNATURES = {
  kick: {
    name: "Kick",
    description: "Leg raised high, body leaning back",
    keypoints: {
      // High leg position
      leg_raised: [13, 14, 15, 16], // knees and ankles
      // Body lean
      body_lean: [5, 6, 11, 12], // shoulders and hips
    },
    threshold: 0.6
  },
  punch: {
    name: "Punch", 
    description: "Arm extended forward, body leaning forward",
    keypoints: {
      // Extended arm
      arm_extended: [7, 8, 9, 10], // elbows and wrists
      // Body lean
      body_lean: [5, 6, 11, 12], // shoulders and hips
    },
    threshold: 0.6
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

  // Check each action signature
  Object.entries(ACTION_SIGNATURES).forEach(([actionName, signature]) => {
    let score = 0;
    let totalChecks = 0;

    // Check keypoint groups
    Object.entries(signature.keypoints).forEach(([groupName, keypointIndices]) => {
      let groupScore = 0;
      let validKeypoints = 0;

      keypointIndices.forEach(index => {
        if (keypoints[index] && keypoints[index].score > MIN_SCORE) {
          validKeypoints++;
          groupScore += keypoints[index].score;
        }
      });

      if (validKeypoints > 0) {
        score += groupScore / validKeypoints;
        totalChecks++;
      }
    });

    if (totalChecks > 0) {
      score = score / totalChecks;
      if (score > bestScore && score >= signature.threshold) {
        bestScore = score;
        bestAction = actionName;
      }
    }
  });

  return {
    action: bestAction,
    confidence: bestScore
  };
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