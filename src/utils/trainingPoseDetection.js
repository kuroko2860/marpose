/**
 * Tiện ích phát hiện tư thế huấn luyện
 * Phát hiện các tư thế cụ thể cho các loại huấn luyện võ thuật
 */

import { TRAINING_POSE_RULES } from '../config/const';

/**
 * Tính khoảng cách giữa hai điểm khóa
 */
const calculateDistance = (kp1, kp2) => {
  if (!kp1 || !kp2 || kp1.length < 2 || kp2.length < 2) return Infinity;
  const dx = kp1[0] - kp2[0];
  const dy = kp1[1] - kp2[1];
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Tính góc giữa ba điểm khóa
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

// Hàm trợ giúp tính khoảng cách tương đối giữa hai tư thế
const calculateRelativeDistance = (defenderPose, attackerPose, defenderKeypoint, attackerKeypoint) => {
  if (!defenderPose?.keypoints_2d || !attackerPose?.keypoints_2d) return null;
  
  const defenderPoint = defenderPose.keypoints_2d[defenderKeypoint];
  const attackerPoint = attackerPose.keypoints_2d[attackerKeypoint];
  
  if (!defenderPoint || !attackerPoint) return null;
  
  return calculateDistance(defenderPoint, attackerPoint);
};

// Hàm trợ giúp tính góc tương đối giữa hai tư thế
const calculateRelativeAngle = (defenderPose, attackerPose, defenderKeypoint, attackerKeypoint) => {
  if (!defenderPose?.keypoints_2d || !attackerPose?.keypoints_2d) return null;
  
  const defenderPoint = defenderPose.keypoints_2d[defenderKeypoint];
  const attackerPoint = attackerPose.keypoints_2d[attackerKeypoint];
  
  if (!defenderPoint || !attackerPoint) return null;
  
  const dx = attackerPoint[0] - defenderPoint[0];
  const dy = attackerPoint[1] - defenderPoint[1];
  return Math.atan2(dy, dx) * (180 / Math.PI);
};

// Hàm trợ giúp kiểm tra người phòng thủ có đối mặt với kẻ tấn công không
const isDefenderFacingAttacker = (defenderPose, attackerPose) => {
  if (!defenderPose?.keypoints_2d || !attackerPose?.keypoints_2d) return false;
  
  const defenderLeftShoulder = defenderPose.keypoints_2d[5]; // Vai trái
  const defenderRightShoulder = defenderPose.keypoints_2d[6]; // Vai phải
  const attackerLeftShoulder = attackerPose.keypoints_2d[5];
  const attackerRightShoulder = attackerPose.keypoints_2d[6];
  
  if (!defenderLeftShoulder || !defenderRightShoulder || 
      !attackerLeftShoulder || !attackerRightShoulder) return false;
  
  // Tính điểm trung tâm
  const defenderCenter = [
    (defenderLeftShoulder[0] + defenderRightShoulder[0]) / 2,
    (defenderLeftShoulder[1] + defenderRightShoulder[1]) / 2
  ];
  const attackerCenter = [
    (attackerLeftShoulder[0] + attackerRightShoulder[0]) / 2,
    (attackerLeftShoulder[1] + attackerRightShoulder[1]) / 2
  ];
  
  // Kiểm tra xem họ có đối mặt với nhau không (vai trái của người phòng thủ nên gần kẻ tấn công hơn)
  const defenderLeftToAttacker = calculateDistance(defenderLeftShoulder, attackerCenter);
  const defenderRightToAttacker = calculateDistance(defenderRightShoulder, attackerCenter);
  
  return defenderLeftToAttacker < defenderRightToAttacker;
};

/**
 * Phát hiện tư thế khoanh tay (Loại huấn luyện 1) - Dựa trên Hình 1
 * Tư thế cho thấy nắm cẳng tay đối thủ bằng một tay, tay kia nâng lên để chặn
 */
export const detectArmCrossing = (defenderPose, attackerPose = null) => {
  if (!defenderPose || !defenderPose.keypoints_2d) return null;
  
  const keypoints = defenderPose.keypoints_2d;
  const rules = TRAINING_POSE_RULES["1"];
  
  // Lấy vị trí các điểm khóa
  const leftWrist = keypoints[rules.keypoints.left_wrist];
  const rightWrist = keypoints[rules.keypoints.right_wrist];
  const leftElbow = keypoints[rules.keypoints.left_elbow];
  const rightElbow = keypoints[rules.keypoints.right_elbow];
  const leftShoulder = keypoints[rules.keypoints.left_shoulder];
  const rightShoulder = keypoints[rules.keypoints.right_shoulder];
  
  
  // Bỏ qua nếu thiếu bất kỳ điểm khóa nào
  if (!leftWrist || !rightWrist || !leftElbow || !rightElbow || 
      !leftShoulder || !rightShoulder) {
    return null;
  }
  // Tính toán độ tin cậy
  let confidence = 0;
  
  // Phân tích tương đối với kẻ tấn công nếu có
  let relativeMetrics = {};
  let relativeFeedback = {};
  
  if (attackerPose) {
    // Tính toán khoảng cách và góc tương đối
    const defenderToAttackerDistance = calculateRelativeDistance(defenderPose, attackerPose, 9, 9); // Cổ tay đến cổ tay
    
    // Tính điểm dựa trên khoảng cách cổ tay đến cổ tay kẻ tấn công (0-70px là mục tiêu) - kiểm tra cả hai cổ tay
    const leftWristToAttackerWrist = calculateRelativeDistance(defenderPose, attackerPose, 9, 9); // Cổ tay trái người phòng thủ đến cổ tay trái kẻ tấn công
    const rightWristToAttackerWrist = calculateRelativeDistance(defenderPose, attackerPose, 10, 10); // Cổ tay phải người phòng thủ đến cổ tay phải kẻ tấn công
    
    let wristToWristScore = 0;
    let leftWristScore = 0;
    let rightWristScore = 0;
    
    // Tính điểm cho cổ tay trái
    if (leftWristToAttackerWrist) {
      if (leftWristToAttackerWrist <= 70) {
        leftWristScore = 1.0; // Điểm đầy đủ trong phạm vi mục tiêu
      } else {
        // Tính điểm giảm dần khi xa khỏi phạm vi mục tiêu
        const maxDistance = 150; // Khoảng cách tối đa để có điểm
        leftWristScore = Math.max(0, 1.0 - ((leftWristToAttackerWrist - 70) / maxDistance));
      }
    }
    
    // Tính điểm cho cổ tay phải
    if (rightWristToAttackerWrist) {
      if (rightWristToAttackerWrist <= 70) {
        rightWristScore = 1.0; // Điểm đầy đủ trong phạm vi mục tiêu
      } else {
        const maxDistance = 150;
        rightWristScore = Math.max(0, 1.0 - ((rightWristToAttackerWrist - 70) / maxDistance));
      }
    }
    
    // Lấy điểm trung bình của cả hai cổ tay
    if (leftWristScore > 0 && rightWristScore > 0) {
      wristToWristScore = (leftWristScore + rightWristScore) / 2; // Trung bình của cả hai
    } else if (leftWristScore > 0) {
      wristToWristScore = leftWristScore; // Chỉ có cổ tay trái
    } else if (rightWristScore > 0) {
      wristToWristScore = rightWristScore; // Chỉ có cổ tay phải
    }
    
    const isHoldingAttackerWrist = wristToWristScore > 0.8; // Coi là nắm nếu điểm > 0.8
    
    // Tính điểm dựa trên khoảng cách mắt cá chân (0-70px là mục tiêu) - chỉ kiểm tra một bên
    const leftAnkleToAttackerAnkle = calculateRelativeDistance(defenderPose, attackerPose, 15, 16); // Mắt cá chân trái người phòng thủ đến mắt cá chân trái kẻ tấn công
    const rightAnkleToAttackerAnkle = calculateRelativeDistance(defenderPose, attackerPose, 16, 15); // Mắt cá chân phải người phòng thủ đến mắt cá chân phải kẻ tấn công
    
    let ankleDistanceScore = 0;
    if (leftAnkleToAttackerAnkle) {
      if (leftAnkleToAttackerAnkle <= 70) {
        ankleDistanceScore = 1.0; // Điểm đầy đủ trong phạm vi mục tiêu
      } else {
        // Tính điểm giảm dần khi xa khỏi phạm vi mục tiêu
        const maxDistance = 150; // Khoảng cách tối đa để có điểm
        ankleDistanceScore = Math.max(0, 1.0 - ((leftAnkleToAttackerAnkle - 70) / maxDistance));
      }
    } else if (rightAnkleToAttackerAnkle) {
      if (rightAnkleToAttackerAnkle <= 70) {
        ankleDistanceScore = 1.0; // Điểm đầy đủ trong phạm vi mục tiêu
      } else {
        const maxDistance = 150;
        ankleDistanceScore = Math.max(0, 1.0 - ((rightAnkleToAttackerAnkle - 70) / maxDistance));
      }
    }
    
    const isLegOnAttackerLeg = ankleDistanceScore > 0.8; // Coi là đè chân nếu điểm > 0.8
    
    // Tính điểm dựa trên khoảng cách cổ tay đến khuỷu tay kẻ tấn công (0-100px là mục tiêu) - kiểm tra cả hai cổ tay
    const leftWristToAttackerElbow = calculateRelativeDistance(defenderPose, attackerPose, 10, 7); // Cổ tay trái người phòng thủ đến khuỷu tay trái kẻ tấn công
    const rightWristToAttackerElbow = calculateRelativeDistance(defenderPose, attackerPose, 9, 8); // Cổ tay phải người phòng thủ đến khuỷu tay phải kẻ tấn công
    
    let elbowCuttingScore = 0;
    let leftElbowScore = 0;
    let rightElbowScore = 0;
    
    // Tính điểm cho cổ tay trái
    if (leftWristToAttackerElbow) {
      if (leftWristToAttackerElbow <= 100) {
        leftElbowScore = 1.0; // Điểm đầy đủ trong phạm vi mục tiêu
      } else {
        // Tính điểm giảm dần khi xa khỏi phạm vi mục tiêu
        const maxDistance = 200; // Khoảng cách tối đa để có điểm
        leftElbowScore = Math.max(0, 1.0 - ((leftWristToAttackerElbow - 100) / maxDistance));
      }
    }
    
    // Tính điểm cho cổ tay phải
    if (rightWristToAttackerElbow) {
      if (rightWristToAttackerElbow <= 100) {
        rightElbowScore = 1.0; // Điểm đầy đủ trong phạm vi mục tiêu
      } else {
        const maxDistance = 200;
        rightElbowScore = Math.max(0, 1.0 - ((rightWristToAttackerElbow - 100) / maxDistance));
      }
    }
    
    // Lấy điểm trung bình của cả hai cổ tay
    if (leftElbowScore > 0 && rightElbowScore > 0) {
      elbowCuttingScore = (leftElbowScore + rightElbowScore) / 2; // Trung bình của cả hai
    } else if (leftElbowScore > 0) {
      elbowCuttingScore = leftElbowScore; // Chỉ có cổ tay trái
    } else if (rightElbowScore > 0) {
      elbowCuttingScore = rightElbowScore; // Chỉ có cổ tay phải
    }
    
    const isCuttingAtAttackerElbow = elbowCuttingScore > 0.8; // Coi là cắt nếu điểm > 0.8
    
    relativeMetrics = {
      defenderToAttackerDistance,
      leftWristToAttackerWrist,
      rightWristToAttackerWrist,
      leftWristScore,
      rightWristScore,
      wristToWristScore,
      isHoldingAttackerWrist,
      leftAnkleToAttackerAnkle,
      rightAnkleToAttackerAnkle,
      ankleDistanceScore,
      isLegOnAttackerLeg,
      leftWristToAttackerElbow,
      rightWristToAttackerElbow,
      leftElbowScore,
      rightElbowScore,
      elbowCuttingScore,
      isCuttingAtAttackerElbow
    };
    
    // Tính toán độ tin cậy dựa trên điểm số tương đối với kẻ tấn công
    confidence += wristToWristScore * 0.3; // 30% trọng số cho nắm cổ tay
    confidence += ankleDistanceScore * 0.3; // 30% trọng số cho đè chân
    confidence += elbowCuttingScore * 0.4; // 40% trọng số cho cắt khuỷu tay
    
    relativeFeedback = {
      wristToWristScore: `Nắm cổ tay: ${(wristToWristScore * 100).toFixed(0)}%`,
      leftWristScore: `Cổ tay trái: ${(leftWristScore * 100).toFixed(0)}%`,
      rightWristScore: `Cổ tay phải: ${(rightWristScore * 100).toFixed(0)}%`,
      ankleDistanceScore: `Đè chân: ${(ankleDistanceScore * 100).toFixed(0)}%`,
      elbowCuttingScore: `Cắt khuỷu tay: ${(elbowCuttingScore * 100).toFixed(0)}%`,
      leftElbowScore: `Cổ tay trái cắt: ${(leftElbowScore * 100).toFixed(0)}%`,
      rightElbowScore: `Cổ tay phải cắt: ${(rightElbowScore * 100).toFixed(0)}%`,
      isHoldingAttackerWrist: isHoldingAttackerWrist ? "✅ Nắm cổ tay đối thủ đúng" : "❌ Cần nắm cổ tay đối thủ gần hơn",
      isLegOnAttackerLeg: isLegOnAttackerLeg ? "✅ Chân đè lên chân đối thủ đúng" : "❌ Cần đè chân lên chân đối thủ",
      isCuttingAtAttackerElbow: isCuttingAtAttackerElbow ? "✅ Tay cắt ở khuỷu tay đối thủ đúng" : "❌ Cần cắt tay ở khuỷu tay đối thủ"
    };
  }
  
  // Kiểm tra xem tư thế có đúng không
  const isCorrect = confidence > 0.7;
  
  return {
    type: 'arm_crossing',
    confidence: Math.min(confidence, 1.0),
    isCorrect: isCorrect,
    metrics: {
      // leftElbowAngle: leftElbowAngle,
      // rightElbowAngle: rightElbowAngle,
      ...relativeMetrics
    },
    feedback: {
      rightWristRaised: rightWristRaised ? "✅ Cổ tay phải ở vị trí chặn đúng" : "❌ Cổ tay phải cần nâng cao hơn",
      overall: isCorrect ? "✅ Tư thế khoanh tay đúng" : "❌ Cần điều chỉnh tư thế",
      ...relativeFeedback
    }
  };
};

/**
 * Phát hiện tư thế giữ chân (Loại huấn luyện 2) - Dựa trên Hình 2
 * Tư thế cho thấy nắm/giữ chân đối thủ bằng cả hai tay
 */
export const detectHoldingLeg = (defenderPose, attackerPose = null) => {
  if (!defenderPose || !defenderPose.keypoints_2d) return null;
  
  const keypoints = defenderPose.keypoints_2d;
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
  
  // Lấy vị trí vai để tính góc
  const leftShoulder = keypoints[rules.keypoints.left_shoulder];
  const rightShoulder = keypoints[rules.keypoints.right_shoulder];
  
  // Bỏ qua nếu thiếu bất kỳ điểm khóa nào
  if (!leftWrist || !rightWrist || !leftElbow || !rightElbow || 
      !leftHip || !rightHip || !leftKnee || !rightKnee ||
      !leftShoulder || !rightShoulder) {
    return null;
  }
  
  // Tính toán độ tin cậy cơ bản
  let confidence = 0;
  
  // Phân tích tương đối với kẻ tấn công nếu có
  let relativeMetrics = {};
  let relativeFeedback = {};
  
  if (attackerPose) {
    // Tính toán khoảng cách mắt cá chân người phòng thủ đến mắt cá chân kẻ tấn công
    const leftAnkleToAttackerAnkle = calculateRelativeDistance(defenderPose, attackerPose, 15, 15); // Mắt cá chân trái người phòng thủ đến mắt cá chân trái kẻ tấn công
    const rightAnkleToAttackerAnkle = calculateRelativeDistance(defenderPose, attackerPose, 16, 16); // Mắt cá chân phải người phòng thủ đến mắt cá chân phải kẻ tấn công
    
    // Tính điểm dựa trên khoảng cách mắt cá chân (100-150px là mục tiêu) - chỉ kiểm tra một bên
    let ankleDistanceScore = 0;
    if (leftAnkleToAttackerAnkle) {
      if (leftAnkleToAttackerAnkle >= 100 && leftAnkleToAttackerAnkle <= 150) {
        ankleDistanceScore = 1.0; // Điểm đầy đủ trong phạm vi mục tiêu
      } else {
        // Tính điểm giảm dần khi xa khỏi phạm vi mục tiêu
        const targetCenter = 125; // Trung tâm phạm vi mục tiêu
        const distanceFromTarget = Math.abs(leftAnkleToAttackerAnkle - targetCenter);
        const maxDistance = 100; // Khoảng cách tối đa để có điểm
        ankleDistanceScore = Math.max(0, 1.0 - (distanceFromTarget / maxDistance));
      }
    } else if (rightAnkleToAttackerAnkle) {
      if (rightAnkleToAttackerAnkle >= 100 && rightAnkleToAttackerAnkle <= 150) {
        ankleDistanceScore = 1.0; // Điểm đầy đủ trong phạm vi mục tiêu
      } else {
        const targetCenter = 125;
        const distanceFromTarget = Math.abs(rightAnkleToAttackerAnkle - targetCenter);
        const maxDistance = 100;
        ankleDistanceScore = Math.max(0, 1.0 - (distanceFromTarget / maxDistance));
      }
    }
    
    const ankleDistanceInRange = ankleDistanceScore > 0.8; // Coi là trong phạm vi nếu điểm > 0.8
    
    // Tính toán khoảng cách cổ tay người phòng thủ đến mắt cá chân kẻ tấn công
    const leftWristToAttackerAnkle = calculateRelativeDistance(defenderPose, attackerPose, 9, 15); // Cổ tay trái người phòng thủ đến mắt cá chân trái kẻ tấn công
    const rightWristToAttackerAnkle = calculateRelativeDistance(defenderPose, attackerPose, 10, 16); // Cổ tay phải người phòng thủ đến mắt cá chân phải kẻ tấn công
    
    // Tính điểm dựa trên khoảng cách cổ tay đến mắt cá chân kẻ tấn công (0-80px là mục tiêu) - kiểm tra cả hai cổ tay
    let wristDistanceScore = 0;
    let leftWristScore = 0;
    let rightWristScore = 0;
    
    // Tính điểm cho cổ tay trái
    if (leftWristToAttackerAnkle) {
      if (leftWristToAttackerAnkle <= 40) {
        leftWristScore = 1.0; // Điểm đầy đủ trong phạm vi mục tiêu
      } else {
        // Tính điểm giảm dần khi xa khỏi phạm vi mục tiêu
        const maxDistance = 200; // Khoảng cách tối đa để có điểm
        leftWristScore = Math.max(0, 1.0 - ((leftWristToAttackerAnkle - 40) / maxDistance));
      }
    }
    
    // Tính điểm cho cổ tay phải
    if (rightWristToAttackerAnkle) {
      if (rightWristToAttackerAnkle <= 40) {
        rightWristScore = 1.0; // Điểm đầy đủ trong phạm vi mục tiêu
      } else {
        const maxDistance = 200;
        rightWristScore = Math.max(0, 1.0 - ((rightWristToAttackerAnkle - 40) / maxDistance));
      }
    }
    
    // Lấy điểm trung bình của cả hai cổ tay
    if (leftWristScore > 0 && rightWristScore > 0) {
      wristDistanceScore = (leftWristScore + rightWristScore) / 2; // Trung bình của cả hai
    } else if (leftWristScore > 0) {
      wristDistanceScore = leftWristScore; // Chỉ có cổ tay trái
    } else if (rightWristScore > 0) {
      wristDistanceScore = rightWristScore; // Chỉ có cổ tay phải
    }
    
    const isWristCloseToAttackerAnkle = wristDistanceScore > 0.8; // Coi là gần nếu điểm > 0.8
    
    // Kiểm tra xem cổ tay có ở trên mắt cá chân kẻ tấn công không
    // const leftWristAboveAttackerAnkle = leftWrist[1] < attackerPose.keypoints_2d[15][1]; // Cổ tay trái cao hơn mắt cá chân trái kẻ tấn công
    // const rightWristAboveAttackerAnkle = rightWrist[1] < attackerPose.keypoints_2d[16][1]; // Cổ tay phải cao hơn mắt cá chân phải kẻ tấn công
    // const isWristAboveAttackerAnkle = leftWristAboveAttackerAnkle || rightWristAboveAttackerAnkle;
    
    relativeMetrics = {
      leftAnkleToAttackerAnkle,
      rightAnkleToAttackerAnkle,
      ankleDistanceScore,
      ankleDistanceInRange,
      leftWristToAttackerAnkle,
      rightWristToAttackerAnkle,
      leftWristScore,
      rightWristScore,
      wristDistanceScore,
      isWristCloseToAttackerAnkle,
      // leftWristAboveAttackerAnkle,
      // rightWristAboveAttackerAnkle,
      // isWristAboveAttackerAnkle
    };
    
    // Tính toán độ tin cậy dựa trên điểm số tương đối với kẻ tấn công
    confidence += ankleDistanceScore * 0.5; // 50% trọng số cho khoảng cách chân
    confidence += wristDistanceScore * 0.5; // 50% trọng số cho khoảng cách cổ tay
    
    relativeFeedback = {
      ankleDistanceScore: `Khoảng cách chân: ${(ankleDistanceScore * 100).toFixed(0)}%`,
      leftWristScore: `Cổ tay trái: ${(leftWristScore * 100).toFixed(0)}%`,
      rightWristScore: `Cổ tay phải: ${(rightWristScore * 100).toFixed(0)}%`,
      wristDistanceScore: `Trung bình tay: ${(wristDistanceScore * 100).toFixed(0)}%`,
      ankleDistanceInRange: ankleDistanceInRange ? "✅ Khoảng cách chân đúng" : "❌ Cần điều chỉnh khoảng cách chân",
      isWristCloseToAttackerAnkle: isWristCloseToAttackerAnkle ? "✅ Tay gần mắt cá chân đối thủ đúng" : "❌ Cần đưa tay gần mắt cá chân đối thủ hơn",
      // isWristAboveAttackerAnkle: isWristAboveAttackerAnkle ? "✅ Tay ở trên mắt cá chân đối thủ đúng" : "❌ Cần đưa tay lên trên mắt cá chân đối thủ"
    };
  }
  
  // Kiểm tra xem tư thế có đúng không (chỉ dựa trên tương đối với kẻ tấn công)
  const isCorrect = confidence > 0.7;
  
  return {
    type: 'holding_leg',
    confidence: Math.min(confidence, 1.0),
    isCorrect: isCorrect,
    metrics: {
      ...relativeMetrics
    },
    feedback: {
      overall: isCorrect ? "✅ Tư thế giữ chân đúng" : "❌ Cần điều chỉnh tư thế",
      ...relativeFeedback
    }
  };
};

/**
 * Phát hiện tư thế huấn luyện dựa trên loại huấn luyện
 */
export const detectTrainingPose = (defenderPose, trainingTypeId, attackerPose = null) => {
  if (!defenderPose || !trainingTypeId) return null;
  
  switch (trainingTypeId) {
    case "1":
      return detectArmCrossing(defenderPose, attackerPose);
    case "2":
      return detectHoldingLeg(defenderPose, attackerPose);
    default:
      return null;
  }
};

/**
 * Phân tích tính đúng đắn của tư thế và cung cấp phản hồi
 */
export const analyzePoseCorrectness = (defenderPose, trainingTypeId, attackerPose = null) => {
  const detection = detectTrainingPose(defenderPose, trainingTypeId, attackerPose);
  
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
