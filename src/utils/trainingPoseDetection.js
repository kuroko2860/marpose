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
  
  // Tính toán các chỉ số cơ bản
  const leftElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
  const rightElbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
  
  // Kiểm tra xem cổ tay phải có cao hơn vai phải không (vị trí chặn)
  const rightWristRaised = rightWrist[1] < rightShoulder[1];
  
  // Kiểm tra xem cổ tay trái có ở độ cao phù hợp không (vị trí nắm)
  const leftWristAtGripHeight = leftWrist[1] > leftShoulder[1] && leftWrist[1] < leftElbow[1];
  
  // Tính toán độ tin cậy
  let confidence = 0;
  if (rightWristRaised) confidence += 0.2;
  if (leftWristAtGripHeight) confidence += 0.2;
  
  // Phân tích tương đối với kẻ tấn công nếu có
  let relativeMetrics = {};
  let relativeFeedback = {};
  
  if (attackerPose) {
    // Tính toán khoảng cách và góc tương đối
    const defenderToAttackerDistance = calculateRelativeDistance(defenderPose, attackerPose, 9, 9); // Cổ tay đến cổ tay
    
    // Kiểm tra xem cổ tay người phòng thủ có gần cổ tay kẻ tấn công không (tay nắm cổ tay đối thủ)
    const leftWristToAttackerWrist = calculateRelativeDistance(defenderPose, attackerPose, 9, 9); // Cổ tay trái người phòng thủ đến cổ tay trái kẻ tấn công
    const rightWristToAttackerWrist = calculateRelativeDistance(defenderPose, attackerPose, 10, 10); // Cổ tay phải người phòng thủ đến cổ tay phải kẻ tấn công
    const isHoldingAttackerWrist = (leftWristToAttackerWrist && leftWristToAttackerWrist < 100) || 
                                   (rightWristToAttackerWrist && rightWristToAttackerWrist < 100); // Trong vòng 80 pixel
    
    // Kiểm tra xem mắt cá chân người phòng thủ có gần mắt cá chân kẻ tấn công không (chân đè lên chân đối thủ)
    const leftAnkleToAttackerAnkle = calculateRelativeDistance(defenderPose, attackerPose, 15, 16); // Mắt cá chân trái người phòng thủ đến mắt cá chân trái kẻ tấn công
    const rightAnkleToAttackerAnkle = calculateRelativeDistance(defenderPose, attackerPose, 16, 15); // Mắt cá chân phải người phòng thủ đến mắt cá chân phải kẻ tấn công
    const isLegOnAttackerLeg = (leftAnkleToAttackerAnkle && leftAnkleToAttackerAnkle < 150) || 
                               (rightAnkleToAttackerAnkle && rightAnkleToAttackerAnkle < 150); // Trong vòng 100 pixel
    
    // Kiểm tra xem tay còn lại của người phòng thủ có cắt ở khuỷu tay kẻ tấn công không
    const leftWristToAttackerElbow = calculateRelativeDistance(defenderPose, attackerPose, 10, 7); // Cổ tay trái người phòng thủ đến khuỷu tay trái kẻ tấn công
    const rightWristToAttackerElbow = calculateRelativeDistance(defenderPose, attackerPose, 9, 8); // Cổ tay phải người phòng thủ đến khuỷu tay phải kẻ tấn công
    const isCuttingAtAttackerElbow = (leftWristToAttackerElbow && leftWristToAttackerElbow < 100) || 
                                     (rightWristToAttackerElbow && rightWristToAttackerElbow < 100); // Trong vòng 120 pixel
    
    relativeMetrics = {
      defenderToAttackerDistance,
      leftWristToAttackerWrist,
      rightWristToAttackerWrist,
      isHoldingAttackerWrist,
      leftAnkleToAttackerAnkle,
      rightAnkleToAttackerAnkle,
      isLegOnAttackerLeg,
      leftWristToAttackerElbow,
      rightWristToAttackerElbow,
      isCuttingAtAttackerElbow
    };
    
    // Thêm độ tin cậy tương đối
    if (isHoldingAttackerWrist) confidence += 0.2;
    if (isLegOnAttackerLeg) confidence += 0.2;
    if (isCuttingAtAttackerElbow) confidence += 0.2;
    
    relativeFeedback = {
      isHoldingAttackerWrist: isHoldingAttackerWrist ? "✅ Nắm cổ tay đối thủ đúng" : "❌ Cần nắm cổ tay đối thủ gần hơn",
      isLegOnAttackerLeg: isLegOnAttackerLeg ? "✅ Chân đè lên chân đối thủ đúng" : "❌ Cần đè chân lên chân đối thủ",
      isCuttingAtAttackerElbow: isCuttingAtAttackerElbow ? "✅ Tay cắt ở khuỷu tay đối thủ đúng" : "❌ Cần cắt tay ở khuỷu tay đối thủ"
    };
  }
  
  // Kiểm tra xem tư thế có đúng không
  const isCorrect = rightWristRaised && confidence > 0.7;
  
  return {
    type: 'arm_crossing',
    confidence: Math.min(confidence, 1.0),
    isCorrect: isCorrect,
    metrics: {
      leftElbowAngle: leftElbowAngle,
      rightElbowAngle: rightElbowAngle,
      rightWristRaised: rightWristRaised,
      leftWristAtGripHeight: leftWristAtGripHeight,
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
  
  // Tính toán các chỉ số cơ bản
  const leftElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
  const rightElbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
  
  // Kiểm tra xem tay có được định vị ở mức chân không (giữa hông và đầu gối)
  const leftWristHeight = leftWrist[1];
  const rightWristHeight = rightWrist[1];
  const leftHipHeight = leftHip[1];
  const rightHipHeight = rightHip[1];
  const leftKneeHeight = leftKnee[1];
  const rightKneeHeight = rightKnee[1];
  
  const leftHandAtLegLevel = leftWristHeight > leftHipHeight && leftWristHeight < leftKneeHeight;
  const rightHandAtLegLevel = rightWristHeight > rightHipHeight && rightWristHeight < rightKneeHeight;
  const handsAtLegLevel = leftHandAtLegLevel && rightHandAtLegLevel;
  
  // Kiểm tra xem khuỷu tay có cong để nắm đúng không (cả hai tay nên cong)
  const leftElbowBent = leftElbowAngle > 80 && leftElbowAngle < 140;
  const rightElbowBent = rightElbowAngle > 80 && rightElbowAngle < 140;
  const elbowsBent = leftElbowBent && rightElbowBent;
  
  // Kiểm tra xem tay có gần nhau không (nắm cùng một chân)
  const handDistance = calculateDistance(leftWrist, rightWrist);
  const shoulderDistance = calculateDistance(leftShoulder, rightShoulder);
  const normalizedHandDistance = handDistance / shoulderDistance;
  const handsCloseTogether = normalizedHandDistance < 0.4; // Tay nên gần nhau
  
  // Kiểm tra xem tay có được định vị về phía trước không (duỗi từ cơ thể)
  const leftWristForward = leftWrist[0] > leftHip[0] - 30; // Cổ tay nên ở phía trước hông
  const rightWristForward = rightWrist[0] < rightHip[0] + 30; // Cổ tay nên ở phía trước hông
  const handsForward = leftWristForward && rightWristForward;
  
  // Tính toán độ tin cậy
  let confidence = 0;
  if (handsAtLegLevel) confidence += 0.3;
  if (elbowsBent) confidence += 0.3;
  if (handsCloseTogether) confidence += 0.2;
  if (handsForward) confidence += 0.2;
  
  // Phân tích tương đối với kẻ tấn công nếu có
  let relativeMetrics = {};
  let relativeFeedback = {};
  
  if (attackerPose) {
    // Tính toán khoảng cách tương đối đến chân kẻ tấn công
    const leftWristToAttackerKnee = calculateRelativeDistance(defenderPose, attackerPose, 9, 13); // Cổ tay trái người phòng thủ đến đầu gối trái kẻ tấn công
    const rightWristToAttackerKnee = calculateRelativeDistance(defenderPose, attackerPose, 10, 14); // Cổ tay phải người phòng thủ đến đầu gối phải kẻ tấn công
    const leftWristToAttackerAnkle = calculateRelativeDistance(defenderPose, attackerPose, 9, 15); // Cổ tay trái người phòng thủ đến mắt cá chân trái kẻ tấn công
    const rightWristToAttackerAnkle = calculateRelativeDistance(defenderPose, attackerPose, 10, 16); // Cổ tay phải người phòng thủ đến mắt cá chân phải kẻ tấn công
    
    // Kiểm tra xem người phòng thủ có nắm chân kẻ tấn công không
    const isGrippingAttackerLeftLeg = leftWristToAttackerKnee && leftWristToAttackerKnee < 80; // Trong vòng 80 pixel
    const isGrippingAttackerRightLeg = rightWristToAttackerKnee && rightWristToAttackerKnee < 80;
    const isGrippingAttackerAnkle = (leftWristToAttackerAnkle && leftWristToAttackerAnkle < 100) || 
                                   (rightWristToAttackerAnkle && rightWristToAttackerAnkle < 100);
    
    // Kiểm tra xem người phòng thủ có được định vị đúng so với kẻ tấn công không
    const defenderFacingAttacker = isDefenderFacingAttacker(defenderPose, attackerPose);
    const defenderToAttackerDistance = calculateRelativeDistance(defenderPose, attackerPose, 11, 11); // Khoảng cách hông đến hông
    
    relativeMetrics = {
      leftWristToAttackerKnee,
      rightWristToAttackerKnee,
      leftWristToAttackerAnkle,
      rightWristToAttackerAnkle,
      isGrippingAttackerLeftLeg,
      isGrippingAttackerRightLeg,
      isGrippingAttackerAnkle,
      defenderFacingAttacker,
      defenderToAttackerDistance
    };
    
    // Thêm độ tin cậy tương đối
    if (defenderFacingAttacker) confidence += 0.1;
    if (isGrippingAttackerLeftLeg || isGrippingAttackerRightLeg) confidence += 0.1;
    if (isGrippingAttackerAnkle) confidence += 0.1;
    
    relativeFeedback = {
      defenderFacingAttacker: defenderFacingAttacker ? "✅ Đối mặt với đối thủ đúng" : "❌ Cần đối mặt với đối thủ",
      isGrippingAttackerLeftLeg: isGrippingAttackerLeftLeg ? "✅ Nắm chân trái đối thủ đúng" : "❌ Cần nắm chân trái đối thủ gần hơn",
      isGrippingAttackerRightLeg: isGrippingAttackerRightLeg ? "✅ Nắm chân phải đối thủ đúng" : "❌ Cần nắm chân phải đối thủ gần hơn",
      isGrippingAttackerAnkle: isGrippingAttackerAnkle ? "✅ Nắm cổ chân đối thủ đúng" : "❌ Cần nắm cổ chân đối thủ gần hơn"
    };
  }
  
  // Kiểm tra xem tư thế có đúng không
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
      normalizedHandDistance: normalizedHandDistance,
      ...relativeMetrics
    },
    feedback: {
      handsAtLegLevel: handsAtLegLevel ? "✅ Tay ở vị trí chân đúng" : "❌ Tay cần hạ xuống vị trí chân",
      elbowsBent: elbowsBent ? "✅ Khuỷu tay cong đúng để nắm chân" : "❌ Khuỷu tay cần cong hơn",
      handsCloseTogether: handsCloseTogether ? "✅ Hai tay nắm chân gần nhau đúng" : "❌ Hai tay cần nắm chân gần nhau hơn",
      handsForward: handsForward ? "✅ Tay duỗi ra trước đúng" : "❌ Tay cần duỗi ra trước hơn",
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
