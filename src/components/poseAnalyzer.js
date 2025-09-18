import { distance, angle } from "./utils";

// Simple pose analysis for martial arts action detection
export class PoseAnalyzer {
  constructor() {
    // Simple thresholds
    this.thresholds = {
      kick: { kneeAngle: 150, footDistance: 60 },
      punch: { elbowAngle: 150, wristDistance: 60 },
      block: { armDistance: 50 },
      dodge: { lateralShift: 50 }
    };

    // Track consecutive frames for each action
    this.frameCounts = {
      kick: 0,
      punch: 0,
      block: 0,
      dodge: 0
    };

    // Required consecutive frames to detect action
    this.requiredFrames = {
      kick: 3,
      punch: 3,
      block: 2,
      dodge: 2
    };

    // Baseline for defender position
    this.defenderBaselineX = null;
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
  }

  // Set baseline for defender position
  setDefenderBaseline(defenderPose) {
    if (!defenderPose || !defenderPose.keypoints) return;
    
    const leftHip = defenderPose.keypoints[11];
    const rightHip = defenderPose.keypoints[12];
    
    if (leftHip.score > 0.3 && rightHip.score > 0.3) {
      this.defenderBaselineX = (leftHip.x + rightHip.x) / 2;
    }
  }

  // Simple kick detection
  detectKick(defenderPose, attackerPose) {
    if (!defenderPose || !attackerPose) return false;

    const defenderKp = defenderPose.keypoints;
    const attackerKp = attackerPose.keypoints;

    const hip = defenderKp[12]; // right hip
    const knee = defenderKp[14]; // right knee
    const ankle = defenderKp[16]; // right ankle
    const attackerChest = attackerKp[6]; // right shoulder

    if (hip.score < 0.3 || knee.score < 0.3 || ankle.score < 0.3 || attackerChest.score < 0.3) {
      return false;
    }

    const kneeAngle = angle(hip, knee, ankle);
    const footDistance = distance(ankle, attackerChest);

    return kneeAngle > this.thresholds.kick.kneeAngle && 
           footDistance < this.thresholds.kick.footDistance;
  }

  // Simple punch detection
  detectPunch(defenderPose, attackerPose) {
    if (!defenderPose || !attackerPose) return false;

    const defenderKp = defenderPose.keypoints;
    const attackerKp = attackerPose.keypoints;

    const shoulder = attackerKp[6]; // right shoulder
    const elbow = attackerKp[8]; // right elbow
    const wrist = attackerKp[10]; // right wrist
    const defenderHead = defenderKp[0]; // nose

    if (shoulder.score < 0.3 || elbow.score < 0.3 || wrist.score < 0.3 || defenderHead.score < 0.3) {
      return false;
    }

    const elbowAngle = angle(shoulder, elbow, wrist);
    const wristDistance = distance(wrist, defenderHead);

    return elbowAngle > this.thresholds.punch.elbowAngle && 
           wristDistance < this.thresholds.punch.wristDistance;
  }

  // Simple block detection
  detectBlock(defenderPose, attackerPose) {
    if (!defenderPose || !attackerPose) return false;

    const defenderKp = defenderPose.keypoints;
    const attackerKp = attackerPose.keypoints;

    const defenderWrist = defenderKp[10]; // right wrist
    const defenderHead = defenderKp[0]; // nose
    const attackerElbow = attackerKp[8]; // right elbow
    const attackerWrist = attackerKp[10]; // right wrist

    if (defenderWrist.score < 0.3 || defenderHead.score < 0.3 || 
        attackerElbow.score < 0.3 || attackerWrist.score < 0.3) {
      return false;
    }

    const armDistance = distance(defenderWrist, defenderHead);
    const attackerElbowAngle = angle(attackerKp[6], attackerElbow, attackerWrist);
    const isAttackerPunching = attackerElbowAngle > 150;

    return armDistance < this.thresholds.block.armDistance && isAttackerPunching;
  }

  // Simple dodge detection
  detectDodge(defenderPose, attackerPose) {
    if (!defenderPose || !attackerPose) return false;

    const defenderKp = defenderPose.keypoints;
    const attackerKp = attackerPose.keypoints;

    const leftHip = defenderKp[11];
    const rightHip = defenderKp[12];

    if (leftHip.score < 0.3 || rightHip.score < 0.3) {
      return false;
    }

    if (!this.defenderBaselineX) {
      this.setDefenderBaseline(defenderPose);
      return false;
    }

    const currentTorsoX = (leftHip.x + rightHip.x) / 2;
    const lateralShift = Math.abs(currentTorsoX - this.defenderBaselineX);

    // Check if attacker is attacking
    const attackerElbow = attackerKp[8];
    const attackerWrist = attackerKp[10];
    const attackerKnee = attackerKp[14];
    const attackerAnkle = attackerKp[16];

    let isAttackerAttacking = false;
    if (attackerElbow.score > 0.3 && attackerWrist.score > 0.3) {
      const punchAngle = angle(attackerKp[6], attackerElbow, attackerWrist);
      isAttackerAttacking = punchAngle > 150;
    }
    if (attackerKnee.score > 0.3 && attackerAnkle.score > 0.3) {
      const kickAngle = angle(attackerKp[12], attackerKnee, attackerAnkle);
      isAttackerAttacking = isAttackerAttacking || kickAngle > 150;
    }

    return lateralShift > this.thresholds.dodge.lateralShift && isAttackerAttacking;
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

    return {
      actions: detectedActions,
      feedback: detectedActions.map(action => action.feedback)
    };
  }

  // Simple feedback for each action
  getKickFeedback(defenderPose, attackerPose) {
    const defenderKp = defenderPose.keypoints;
    const hip = defenderKp[12];
    const knee = defenderKp[14];
    const ankle = defenderKp[16];

    const kneeAngle = angle(hip, knee, ankle);
    
    if (kneeAngle > 170) {
      return {
        message: "Cú đá tốt! Gối thẳng và mạnh mẽ.",
        priority: "low"
      };
    } else if (kneeAngle > 160) {
      return {
        message: "Cú đá ổn, nhưng có thể thẳng gối hơn.",
        priority: "medium"
      };
    } else {
      return {
        message: "Cú đá cần được thực hiện với gối thẳng hơn.",
        priority: "high"
      };
    }
  }

  getPunchFeedback(defenderPose, attackerPose) {
    const attackerKp = attackerPose.keypoints;
    const shoulder = attackerKp[6];
    const elbow = attackerKp[8];
    const wrist = attackerKp[10];

    const elbowAngle = angle(shoulder, elbow, wrist);
    
    if (elbowAngle > 170) {
      return {
        message: "Cú đấm xuất sắc! Cánh tay thẳng và mạnh mẽ.",
        priority: "low"
      };
    } else if (elbowAngle > 160) {
      return {
        message: "Cú đấm tốt, nhưng có thể thẳng cánh tay hơn.",
        priority: "medium"
      };
    } else {
      return {
        message: "Cú đấm cần được thực hiện với cánh tay thẳng hơn.",
        priority: "high"
      };
    }
  }

  getBlockFeedback(defenderPose, attackerPose) {
    const defenderKp = defenderPose.keypoints;
    const wrist = defenderKp[10];
    const head = defenderKp[0];

    const armDistance = distance(wrist, head);
    
    if (armDistance < 30) {
      return {
        message: "Cú chặn hoàn hảo! Bảo vệ đầu tốt.",
        priority: "low"
      };
    } else if (armDistance < 40) {
      return {
        message: "Cú chặn tốt, nhưng có thể gần đầu hơn.",
        priority: "medium"
      };
    } else {
      return {
        message: "Cú chặn cần được thực hiện gần đầu hơn để bảo vệ tốt hơn.",
        priority: "high"
      };
    }
  }

  getDodgeFeedback(defenderPose, attackerPose) {
    const defenderKp = defenderPose.keypoints;
    const leftHip = defenderKp[11];
    const rightHip = defenderKp[12];

    const currentTorsoX = (leftHip.x + rightHip.x) / 2;
    const lateralShift = Math.abs(currentTorsoX - this.defenderBaselineX);
    
    if (lateralShift > 80) {
      return {
        message: "Cú né tuyệt vời! Chuyển động ngang rõ ràng.",
        priority: "low"
      };
    } else if (lateralShift > 60) {
      return {
        message: "Cú né tốt, nhưng có thể chuyển động ngang nhiều hơn.",
        priority: "medium"
      };
    } else {
      return {
        message: "Cú né cần chuyển động ngang rõ ràng hơn.",
        priority: "high"
      };
    }
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