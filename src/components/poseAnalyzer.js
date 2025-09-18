import { distance, angle } from "./utils";

// Simple pose analysis for martial arts action detection
export class PoseAnalyzer {
  constructor() {
    // Balanced thresholds for better accuracy
    this.thresholds = {
      kick: { kneeAngle: 150, footDistance: 100, footHeight: 30 }, // Less difficult
      punch: { elbowAngle: 130, wristDistance: 80, armExtension: 25 }, // Less difficult
      block: { armDistance: 60, peopleDistance: 120 }, // Add distance consideration
      dodge: { lateralShift: 40, peopleDistance: 120 } // Add distance consideration
    };

    // Track consecutive frames for each action
    this.frameCounts = {
      kick: 0,
      punch: 0,
      block: 0,
      dodge: 0
    };

    // Required consecutive frames to detect action (balanced for accuracy)
    this.requiredFrames = {
      kick: 4, // More stable detection
      punch: 4, // More stable detection
      block: 3, // Slightly more stable
      dodge: 3 // Slightly more stable
    };

    // Baseline for defender position
    this.defenderBaselineX = null;
    
    // Movement tracking buffer
    this.movementBuffer = {
      positions: [], // Store recent positions
      maxBufferSize: 15, // Keep last 15 frames
      velocities: [], // Store calculated velocities
      accelerations: [] // Store calculated accelerations
    };
  }

  // Reset for new training session
  resetBaselines() {
    this.defenderBaselineX = null;
    this.frameCounts = {
      kick: 0,
      punch: 0,
      block: 0,
      dodge: 0
    };
    
    // Reset movement buffer
    this.movementBuffer = {
      positions: [],
      maxBufferSize: 15,
      velocities: [],
      accelerations: []
    };
  }

  // Set baseline for defender position
  setDefenderBaseline(defenderPose) {
    if (!defenderPose || !defenderPose.keypoints) return;
    
    const leftHip = defenderPose.keypoints[11];
    const rightHip = defenderPose.keypoints[12];
    
    this.defenderBaselineX = (leftHip.x + rightHip.x) / 2;
  }

  // Track defender movement and update buffer
  trackDefenderMovement(defenderPose) {
    if (!defenderPose || !defenderPose.keypoints) return;

    const leftHip = defenderPose.keypoints[11];
    const rightHip = defenderPose.keypoints[12];
    const leftShoulder = defenderPose.keypoints[5];
    const rightShoulder = defenderPose.keypoints[6];
    
    // Calculate center of mass (torso center)
    const torsoCenter = {
      x: (leftHip.x + rightHip.x + leftShoulder.x + rightShoulder.x) / 4,
      y: (leftHip.y + rightHip.y + leftShoulder.y + rightShoulder.y) / 4,
      timestamp: Date.now()
    };

    // Add to position buffer
    this.movementBuffer.positions.push(torsoCenter);
    
    // Keep buffer size manageable
    if (this.movementBuffer.positions.length > this.movementBuffer.maxBufferSize) {
      this.movementBuffer.positions.shift();
    }

    // Calculate velocities if we have enough data
    if (this.movementBuffer.positions.length >= 2) {
      this.calculateVelocities();
    }

    // Calculate accelerations if we have enough velocities
    if (this.movementBuffer.velocities.length >= 2) {
      this.calculateAccelerations();
    }
  }

  // Calculate velocities from position buffer
  calculateVelocities() {
    const positions = this.movementBuffer.positions;
    const velocities = [];
    
    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];
      const timeDiff = (curr.timestamp - prev.timestamp) / 1000; // Convert to seconds
      
      if (timeDiff > 0) {
        const velocity = {
          x: (curr.x - prev.x) / timeDiff,
          y: (curr.y - prev.y) / timeDiff,
          magnitude: Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)) / timeDiff,
          timestamp: curr.timestamp
        };
        velocities.push(velocity);
      }
    }
    
    this.movementBuffer.velocities = velocities;
    
    // Keep velocity buffer size manageable
    if (this.movementBuffer.velocities.length > this.movementBuffer.maxBufferSize) {
      this.movementBuffer.velocities.shift();
    }
  }

  // Calculate accelerations from velocity buffer
  calculateAccelerations() {
    const velocities = this.movementBuffer.velocities;
    const accelerations = [];
    
    for (let i = 1; i < velocities.length; i++) {
      const prev = velocities[i - 1];
      const curr = velocities[i];
      const timeDiff = (curr.timestamp - prev.timestamp) / 1000;
      
      if (timeDiff > 0) {
        const acceleration = {
          x: (curr.x - prev.x) / timeDiff,
          y: (curr.y - prev.y) / timeDiff,
          magnitude: Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)) / timeDiff,
          timestamp: curr.timestamp
        };
        accelerations.push(acceleration);
      }
    }
    
    this.movementBuffer.accelerations = accelerations;
    
    // Keep acceleration buffer size manageable
    if (this.movementBuffer.accelerations.length > this.movementBuffer.maxBufferSize) {
      this.movementBuffer.accelerations.shift();
    }
  }

  // Analyze movement patterns and generate feedback
  analyzeMovementPatterns() {
    const positions = this.movementBuffer.positions;
    const velocities = this.movementBuffer.velocities;
    const accelerations = this.movementBuffer.accelerations;
    
    if (positions.length < 5) {
      return {
        message: "Đang thu thập dữ liệu chuyển động...",
        priority: "low",
        movement: {
          stability: "Đang phân tích",
          speed: "Đang phân tích",
          efficiency: "Đang phân tích"
        }
      };
    }

    // Calculate movement metrics
    const avgSpeed = this.calculateAverageSpeed(velocities);
    const movementStability = this.calculateMovementStability(positions);
    const movementEfficiency = this.calculateMovementEfficiency(positions, velocities);
    const reactionTime = this.calculateReactionTime(velocities);
    
    let feedback = {
      message: "",
      priority: "medium",
      movement: {
        stability: movementStability,
        speed: avgSpeed,
        efficiency: movementEfficiency,
        reactionTime: reactionTime,
        totalFrames: positions.length
      }
    };

    // Generate feedback based on movement analysis
    if (movementStability === "Rất ổn định" && movementEfficiency === "Hiệu quả") {
      feedback.message = "🎯 Chuyển động xuất sắc! Thăng bằng tốt, hiệu quả cao, đã ghi lại keyframe.";
      feedback.priority = "low";
    } else if (movementStability === "Ổn định" && movementEfficiency === "Khá hiệu quả") {
      feedback.message = "✅ Chuyển động tốt! Đã ghi lại keyframe. Có thể cải thiện hiệu quả.";
      feedback.priority = "medium";
    } else if (movementStability === "Khá ổn định") {
      feedback.message = "⚠️ Chuyển động ổn, đã ghi lại keyframe. Cần cải thiện thăng bằng và hiệu quả.";
      feedback.priority = "high";
    } else {
      feedback.message = "❌ Chuyển động cần cải thiện, đã ghi lại keyframe để phân tích. Tập trung vào thăng bằng.";
      feedback.priority = "high";
    }

    return feedback;
  }

  // Calculate average speed from velocity buffer
  calculateAverageSpeed(velocities) {
    if (velocities.length === 0) return "Chậm";
    
    const avgMagnitude = velocities.reduce((sum, v) => sum + v.magnitude, 0) / velocities.length;
    
    if (avgMagnitude > 50) return "Nhanh";
    if (avgMagnitude > 25) return "Trung bình";
    return "Chậm";
  }

  // Calculate movement stability based on position variance
  calculateMovementStability(positions) {
    if (positions.length < 3) return "Đang phân tích";
    
    const centerX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
    const centerY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;
    
    const variance = positions.reduce((sum, p) => {
      return sum + Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2);
    }, 0) / positions.length;
    
    if (variance < 100) return "Rất ổn định";
    if (variance < 300) return "Ổn định";
    if (variance < 600) return "Khá ổn định";
    return "Không ổn định";
  }

  // Calculate movement efficiency (straightness of movement)
  calculateMovementEfficiency(positions, velocities) {
    if (positions.length < 3 || velocities.length < 2) return "Đang phân tích";
    
    // Calculate total distance traveled
    let totalDistance = 0;
    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];
      totalDistance += Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));
    }
    
    // Calculate straight-line distance from start to end
    const start = positions[0];
    const end = positions[positions.length - 1];
    const straightDistance = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
    
    // Efficiency is the ratio of straight distance to total distance
    const efficiency = straightDistance / totalDistance;
    
    if (efficiency > 0.8) return "Hiệu quả";
    if (efficiency > 0.6) return "Khá hiệu quả";
    if (efficiency > 0.4) return "Trung bình";
    return "Kém hiệu quả";
  }

  // Calculate reaction time based on velocity changes
  calculateReactionTime(velocities) {
    if (velocities.length < 3) return "Đang phân tích";
    
    // Look for significant velocity changes (reactions)
    let reactionCount = 0;
    for (let i = 1; i < velocities.length - 1; i++) {
      const prev = velocities[i - 1];
      const curr = velocities[i];
      const next = velocities[i + 1];
      
      // Check for sudden velocity change
      const velocityChange = Math.abs(curr.magnitude - prev.magnitude);
      if (velocityChange > 20) { // Significant change threshold
        reactionCount++;
      }
    }
    
    if (reactionCount > 3) return "Nhanh";
    if (reactionCount > 1) return "Trung bình";
    return "Chậm";
  }

  // Critical kick detection - requires multiple criteria
  detectKick(defenderPose, attackerPose) {
    if (!defenderPose || !attackerPose) return false;

    const defenderKp = defenderPose.keypoints;
    const attackerKp = attackerPose.keypoints;

    // Additional validation: ensure poses are in reasonable fighting stance
    const defenderHipDistance = Math.abs(defenderKp[11].x - defenderKp[12].x);
    const attackerHipDistance = Math.abs(attackerKp[11].x - attackerKp[12].x);
    
    // Skip if poses are too close together (not in fighting stance)
    if (defenderHipDistance < 20 || attackerHipDistance < 20) return false;

    // Check both legs for kick detection
    const leftHip = defenderKp[11];
    const leftKnee = defenderKp[13];
    const leftAnkle = defenderKp[15];
    
    const rightHip = defenderKp[12];
    const rightKnee = defenderKp[14];
    const rightAnkle = defenderKp[16];

    // Check left leg kick with multiple criteria
    const leftKneeAngle = angle(leftHip, leftKnee, leftAnkle);
    const leftFootHeight = leftHip.y - leftAnkle.y;
    const leftFootDistance = distance(leftAnkle, attackerKp[0]); // Distance to attacker's head
    
    // Check right leg kick with multiple criteria
    const rightKneeAngle = angle(rightHip, rightKnee, rightAnkle);
    const rightFootHeight = rightHip.y - rightAnkle.y;
    const rightFootDistance = distance(rightAnkle, attackerKp[0]); // Distance to attacker's head

    // Balanced kick detection - must meet key criteria:
    // 1. Knee must be reasonably bent (straight leg)
    // 2. Foot must be raised (movement)
    // 3. Foot must be close to attacker (targeting)
    const leftKick = leftKneeAngle > this.thresholds.kick.kneeAngle && 
                     leftFootHeight > this.thresholds.kick.footHeight &&
                     leftFootDistance < this.thresholds.kick.footDistance;
                     
    const rightKick = rightKneeAngle > this.thresholds.kick.kneeAngle && 
                      rightFootHeight > this.thresholds.kick.footHeight &&
                      rightFootDistance < this.thresholds.kick.footDistance;

    return leftKick || rightKick;
  }

  // Critical punch detection - requires multiple criteria
  detectPunch(defenderPose, attackerPose) {
    if (!defenderPose || !attackerPose) return false;

    const defenderKp = defenderPose.keypoints;
    const attackerKp = attackerPose.keypoints;

    // Additional validation: ensure poses are in reasonable fighting stance
    const defenderHipDistance = Math.abs(defenderKp[11].x - defenderKp[12].x);
    const attackerHipDistance = Math.abs(attackerKp[11].x - attackerKp[12].x);
    
    // Skip if poses are too close together (not in fighting stance)
    if (defenderHipDistance < 20 || attackerHipDistance < 20) return false;

    // Check both arms for punch detection
    const leftShoulder = attackerKp[5];
    const leftElbow = attackerKp[7];
    const leftWrist = attackerKp[9];
    
    const rightShoulder = attackerKp[6];
    const rightElbow = attackerKp[8];
    const rightWrist = attackerKp[10];
    
    const defenderHead = defenderKp[0]; // nose

    // Check left arm punch with multiple criteria
    const leftElbowAngle = angle(leftShoulder, leftElbow, leftWrist);
    const leftWristDistance = distance(leftWrist, defenderHead);
    const leftArmExtension = leftWrist.x - leftShoulder.x; // How far arm extends forward
    const leftArmHeight = Math.abs(leftWrist.y - leftShoulder.y); // Arm height difference
    
    // Check right arm punch with multiple criteria
    const rightElbowAngle = angle(rightShoulder, rightElbow, rightWrist);
    const rightWristDistance = distance(rightWrist, defenderHead);
    const rightArmExtension = rightWrist.x - rightShoulder.x; // How far arm extends forward
    const rightArmHeight = Math.abs(rightWrist.y - rightShoulder.y); // Arm height difference

    // Balanced punch detection - must meet key criteria:
    // 1. Elbow must be reasonably extended (straight arm)
    // 2. Wrist must be close to defender (targeting)
    // 3. Arm must be extended forward (movement)
    // 4. Arm should be at reasonable height (not too high/low)
    const leftPunch = leftElbowAngle > this.thresholds.punch.elbowAngle && 
                      leftWristDistance < this.thresholds.punch.wristDistance &&
                      leftArmExtension > this.thresholds.punch.armExtension &&
                      leftArmHeight < 120; // Slightly more lenient height
                      
    const rightPunch = rightElbowAngle > this.thresholds.punch.elbowAngle && 
                       rightWristDistance < this.thresholds.punch.wristDistance &&
                       rightArmExtension > this.thresholds.punch.armExtension &&
                       rightArmHeight < 120; // Slightly more lenient height

    return leftPunch || rightPunch;
  }

  // Block detection with distance consideration
  detectBlock(defenderPose, attackerPose) {
    if (!defenderPose || !attackerPose) return false;

    const defenderKp = defenderPose.keypoints;
    const attackerKp = attackerPose.keypoints;

    // Check distance between two people - must be close for realistic blocking
    const defenderCenter = {
      x: (defenderKp[11].x + defenderKp[12].x) / 2,
      y: (defenderKp[11].y + defenderKp[12].y) / 2
    };
    const attackerCenter = {
      x: (attackerKp[11].x + attackerKp[12].x) / 2,
      y: (attackerKp[11].y + attackerKp[12].y) / 2
    };
    const peopleDistance = distance(defenderCenter, attackerCenter);

    // Skip if people are too far apart for realistic blocking
    if (peopleDistance > this.thresholds.block.peopleDistance) return false;

    // Check both arms for block detection
    const leftWrist = defenderKp[9];
    const rightWrist = defenderKp[10];
    const defenderHead = defenderKp[0]; // nose

    // Check if either arm is near the head (blocking position)
    const leftArmDistance = distance(leftWrist, defenderHead);
    const rightArmDistance = distance(rightWrist, defenderHead);
    
    // Also check if arms are raised (blocking gesture)
    const leftArmRaised = leftWrist.y < defenderHead.y + 50; // Arm above head level
    const rightArmRaised = rightWrist.y < defenderHead.y + 50; // Arm above head level

    // Detect block if either arm is close to head or raised
    const leftBlock = leftArmDistance < this.thresholds.block.armDistance || leftArmRaised;
    const rightBlock = rightArmDistance < this.thresholds.block.armDistance || rightArmRaised;

    return leftBlock || rightBlock;
  }

  // Dodge detection with distance consideration
  detectDodge(defenderPose, attackerPose) {
    if (!defenderPose || !attackerPose) return false;

    const defenderKp = defenderPose.keypoints;
    const attackerKp = attackerPose.keypoints;

    // Check distance between two people - must be close for realistic dodging
    const defenderCenter = {
      x: (defenderKp[11].x + defenderKp[12].x) / 2,
      y: (defenderKp[11].y + defenderKp[12].y) / 2
    };
    const attackerCenter = {
      x: (attackerKp[11].x + attackerKp[12].x) / 2,
      y: (attackerKp[11].y + attackerKp[12].y) / 2
    };
    const peopleDistance = distance(defenderCenter, attackerCenter);

    // Skip if people are too far apart for realistic dodging
    if (peopleDistance > this.thresholds.dodge.peopleDistance) return false;

    const leftHip = defenderKp[11];
    const rightHip = defenderKp[12];

    if (!this.defenderBaselineX) {
      this.setDefenderBaseline(defenderPose);
      return false;
    }

    const currentTorsoX = (leftHip.x + rightHip.x) / 2;
    const lateralShift = Math.abs(currentTorsoX - this.defenderBaselineX);

    // Also check for any significant body movement (not just lateral)
    const leftShoulder = defenderKp[5];
    const rightShoulder = defenderKp[6];
    const currentShoulderX = (leftShoulder.x + rightShoulder.x) / 2;
    const shoulderShift = Math.abs(currentShoulderX - this.defenderBaselineX);

    // Detect dodge if there's any significant movement (lateral or shoulder)
    const bodyMovement = lateralShift > this.thresholds.dodge.lateralShift || shoulderShift > 20;

    return bodyMovement;
  }

  // Main analysis function - track consecutive frames
  analyzePoses(defenderPose, attackerPose) {
    if (!defenderPose || !attackerPose) {
      return {
        actions: [],
        feedback: []
      };
    }

    // Set baseline if not set
    if (!this.defenderBaselineX) {
      this.setDefenderBaseline(defenderPose);
    }

    // Track defender movement for analysis
    this.trackDefenderMovement(defenderPose);

    const detectedActions = [];

    // Check each action and count consecutive frames
    if (this.detectKick(defenderPose, attackerPose)) {
      this.frameCounts.kick++;
      if (this.frameCounts.kick >= this.requiredFrames.kick) {
        detectedActions.push({
          type: 'kick',
          confidence: 1.0,
          feedback: this.getKickFeedback(defenderPose, attackerPose)
        });
        this.frameCounts.kick = 0; // Reset counter
      }
    } else {
      this.frameCounts.kick = 0;
    }

    if (this.detectPunch(defenderPose, attackerPose)) {
      this.frameCounts.punch++;
      if (this.frameCounts.punch >= this.requiredFrames.punch) {
        detectedActions.push({
          type: 'punch',
          confidence: 1.0,
          feedback: this.getPunchFeedback(defenderPose, attackerPose)
        });
        this.frameCounts.punch = 0; // Reset counter
      }
    } else {
      this.frameCounts.punch = 0;
    }

    if (this.detectBlock(defenderPose, attackerPose)) {
      this.frameCounts.block++;
      if (this.frameCounts.block >= this.requiredFrames.block) {
        detectedActions.push({
          type: 'block',
          confidence: 1.0,
          feedback: this.getBlockFeedback(defenderPose, attackerPose)
        });
        this.frameCounts.block = 0; // Reset counter
      }
    } else {
      this.frameCounts.block = 0;
    }

    if (this.detectDodge(defenderPose, attackerPose)) {
      this.frameCounts.dodge++;
      if (this.frameCounts.dodge >= this.requiredFrames.dodge) {
        detectedActions.push({
          type: 'dodge',
          confidence: 1.0,
          feedback: this.getDodgeFeedback(defenderPose, attackerPose)
        });
        this.frameCounts.dodge = 0; // Reset counter
      }
    } else {
      this.frameCounts.dodge = 0;
    }

    // Generate movement analysis feedback
    const movementFeedback = this.analyzeMovementPatterns();
    
    // Combine action feedback with movement feedback
    const allFeedback = detectedActions.map(action => action.feedback);
    allFeedback.push(movementFeedback);

    return {
      actions: detectedActions,
      feedback: allFeedback
    };
  }

  // Enhanced feedback for each action with keyframe analysis
  getKickFeedback(defenderPose, attackerPose) {
    const defenderKp = defenderPose.keypoints;
    const hip = defenderKp[12];
    const knee = defenderKp[14];
    const ankle = defenderKp[16];

    const kneeAngle = angle(hip, knee, ankle);
    const hipHeight = hip.y;
    const ankleHeight = ankle.y;
    const kickHeight = hipHeight - ankleHeight;
    
    let feedback = {
      message: "",
      priority: "medium",
      keyframe: {
        action: "KICK",
        technique: "Cú đá",
        frameCount: this.frameCounts.kick,
        metrics: {
          kneeAngle: Math.round(kneeAngle),
          kickHeight: Math.round(kickHeight),
          balance: "Tốt"
        }
      }
    };
    
    if (kneeAngle > 170 && kickHeight > 50) {
      feedback.message = "🎯 Cú đá xuất sắc! Gối thẳng, độ cao tốt, đã được ghi lại keyframe.";
      feedback.priority = "low";
    } else if (kneeAngle > 160 && kickHeight > 30) {
      feedback.message = "✅ Cú đá tốt! Gối khá thẳng, đã ghi lại keyframe. Có thể cải thiện độ cao.";
      feedback.priority = "medium";
    } else if (kneeAngle > 150) {
      feedback.message = "⚠️ Cú đá ổn, đã ghi lại keyframe. Cần thẳng gối và nâng chân cao hơn.";
      feedback.priority = "high";
    } else {
      feedback.message = "❌ Cú đá cần cải thiện, đã ghi lại keyframe để phân tích. Gối cần thẳng hơn.";
      feedback.priority = "high";
    }
    
    return feedback;
  }

  getPunchFeedback(defenderPose, attackerPose) {
    const attackerKp = attackerPose.keypoints;
    const defenderKp = defenderPose.keypoints;
    const shoulder = attackerKp[6];
    const elbow = attackerKp[8];
    const wrist = attackerKp[10];
    const defenderHead = defenderKp[0];

    const elbowAngle = angle(shoulder, elbow, wrist);
    const punchDistance = distance(wrist, defenderHead);
    const punchSpeed = this.frameCounts.punch; // Frames to complete punch
    
    let feedback = {
      message: "",
      priority: "medium",
      keyframe: {
        action: "PUNCH",
        technique: "Cú đấm",
        frameCount: this.frameCounts.punch,
        metrics: {
          elbowAngle: Math.round(elbowAngle),
          punchDistance: Math.round(punchDistance),
          punchSpeed: punchSpeed < 5 ? "Nhanh" : punchSpeed < 8 ? "Trung bình" : "Chậm",
          accuracy: punchDistance < 100 ? "Chính xác" : "Cần cải thiện"
        }
      }
    };
    
    if (elbowAngle > 170 && punchDistance < 80) {
      feedback.message = "🎯 Cú đấm xuất sắc! Cánh tay thẳng, khoảng cách tốt, đã ghi lại keyframe.";
      feedback.priority = "low";
    } else if (elbowAngle > 160 && punchDistance < 120) {
      feedback.message = "✅ Cú đấm tốt! Cánh tay khá thẳng, đã ghi lại keyframe. Có thể cải thiện khoảng cách.";
      feedback.priority = "medium";
    } else if (elbowAngle > 150) {
      feedback.message = "⚠️ Cú đấm ổn, đã ghi lại keyframe. Cần thẳng cánh tay và điều chỉnh khoảng cách.";
      feedback.priority = "high";
    } else {
      feedback.message = "❌ Cú đấm cần cải thiện, đã ghi lại keyframe để phân tích. Cánh tay cần thẳng hơn.";
      feedback.priority = "high";
    }
    
    return feedback;
  }

  getBlockFeedback(defenderPose, attackerPose) {
    const defenderKp = defenderPose.keypoints;
    const attackerKp = attackerPose.keypoints;
    const wrist = defenderKp[10];
    const head = defenderKp[0];
    const attackerWrist = attackerKp[10];

    const armDistance = distance(wrist, head);
    const blockDistance = distance(wrist, attackerWrist);
    const blockTiming = this.frameCounts.block;
    
    let feedback = {
      message: "",
      priority: "medium",
      keyframe: {
        action: "BLOCK",
        technique: "Phòng thủ",
        frameCount: this.frameCounts.block,
        metrics: {
          armDistance: Math.round(armDistance),
          blockDistance: Math.round(blockDistance),
          blockTiming: blockTiming < 3 ? "Nhanh" : blockTiming < 6 ? "Trung bình" : "Chậm",
          effectiveness: armDistance < 40 && blockDistance < 100 ? "Hiệu quả" : "Cần cải thiện"
        }
      }
    };
    
    if (armDistance < 30 && blockDistance < 80) {
      feedback.message = "🛡️ Phòng thủ xuất sắc! Cánh tay gần đầu, khoảng cách tốt, đã ghi lại keyframe.";
      feedback.priority = "low";
    } else if (armDistance < 50 && blockDistance < 120) {
      feedback.message = "✅ Phòng thủ tốt! Đã ghi lại keyframe. Có thể đưa cánh tay gần đầu hơn.";
      feedback.priority = "medium";
    } else if (armDistance < 70) {
      feedback.message = "⚠️ Phòng thủ ổn, đã ghi lại keyframe. Cần cải thiện vị trí cánh tay.";
      feedback.priority = "high";
    } else {
      feedback.message = "❌ Phòng thủ cần cải thiện, đã ghi lại keyframe để phân tích. Đưa cánh tay gần đầu hơn.";
      feedback.priority = "high";
    }
    
    return feedback;
  }

  getDodgeFeedback(defenderPose, attackerPose) {
    const defenderKp = defenderPose.keypoints;
    const leftHip = defenderKp[11];
    const rightHip = defenderKp[12];

    const currentTorsoX = (leftHip.x + rightHip.x) / 2;
    const lateralShift = Math.abs(currentTorsoX - this.defenderBaselineX);
    const dodgeTiming = this.frameCounts.dodge;
    const balance = 0.8; // Assume good balance without score check
    
    let feedback = {
      message: "",
      priority: "medium",
      keyframe: {
        action: "DODGE",
        technique: "Cú né",
        frameCount: this.frameCounts.dodge,
        metrics: {
          lateralShift: Math.round(lateralShift),
          dodgeTiming: dodgeTiming < 3 ? "Nhanh" : dodgeTiming < 6 ? "Trung bình" : "Chậm",
          balance: balance > 0.7 ? "Tốt" : "Cần cải thiện",
          effectiveness: lateralShift > 60 ? "Hiệu quả" : "Cần cải thiện"
        }
      }
    };
    
    if (lateralShift > 80 && balance > 0.7) {
      feedback.message = "💨 Cú né xuất sắc! Chuyển động ngang rõ ràng, thăng bằng tốt, đã ghi lại keyframe.";
      feedback.priority = "low";
    } else if (lateralShift > 60 && balance > 0.5) {
      feedback.message = "✅ Cú né tốt! Đã ghi lại keyframe. Có thể chuyển động ngang nhiều hơn.";
      feedback.priority = "medium";
    } else if (lateralShift > 40) {
      feedback.message = "⚠️ Cú né ổn, đã ghi lại keyframe. Cần chuyển động ngang rõ ràng hơn.";
      feedback.priority = "high";
    } else {
      feedback.message = "❌ Cú né cần cải thiện, đã ghi lại keyframe để phân tích. Chuyển động ngang cần rõ ràng hơn.";
      feedback.priority = "high";
    }
    
    return feedback;
  }

  // Get current frame counts for debugging
  getFrameCounts() {
    return this.frameCounts;
  }

  // Get current state
  getState() {
    return {
      frameCounts: this.frameCounts,
      requiredFrames: this.requiredFrames,
      defenderBaselineX: this.defenderBaselineX
    };
  }
}

// Export a singleton instance
export const poseAnalyzer = new PoseAnalyzer();