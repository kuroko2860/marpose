// Draw pose skeleton on canvas
export const drawPoseSkeleton = (
  ctx,
  poses,
  canvasWidth,
  canvasHeight,
  isDetailView = false,
  selectedPersonRoles
) => {
  if (!poses || poses.length === 0) return;

  // Adjust line width and keypoint size based on view type
  const lineWidth = isDetailView ? 4 : 4;
  const keypointRadius = isDetailView ? 6 : 6;
  const labelFontSize = isDetailView ? "bold 20px Arial" : "bold 14px Arial";

  poses.forEach((pose, index) => {
    // Handle both API format (keypoints_2d) and old format (keypoints)
    const keypoints2d = pose.keypoints_2d || pose.keypoints || [];
    
    // Convert API format [x, y] to {x, y, score} format for compatibility
    const keypoints = keypoints2d.map((kp, i) => {
      if (Array.isArray(kp)) {
        // API format: [x, y]
        return { x: kp[0], y: kp[1], score: 1.0 }; // Assume high confidence for API data
      } else if (kp && typeof kp === 'object' && 'x' in kp) {
        // Old format: {x, y, score}
        return kp;
      }
      return null;
    }).filter(kp => kp !== null);

    // Determine role and colors based on assigned roles
    let skeletonColor, keypointColor;

    if (selectedPersonRoles[index] === "defender") {
      // Green for defender
      skeletonColor = "#22c55e";
      keypointColor = "#16a34a";
    } else if (selectedPersonRoles[index] === "attacker") {
      // Red for attacker
      skeletonColor = "#ef4444";
      keypointColor = "#dc2626";
    } else {
      // Purple for unassigned roles
      skeletonColor = "#8b5cf6";
      keypointColor = "#7c3aed";
    }

    // Draw skeleton connections (simplified MoveNet connections)
    const connections = [
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 4], // Head
      [5, 6],
      [5, 7],
      [6, 8],
      [7, 9],
      [8, 10], // Arms
      [5, 11],
      [6, 12],
      [11, 12], // Torso
      [11, 13],
      [12, 14],
      [13, 15],
      [14, 16], // Legs
    ];

    // Draw skeleton with thicker lines for detail view
    ctx.strokeStyle = skeletonColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    connections.forEach(([startIdx, endIdx]) => {
      const startPoint = keypoints[startIdx];
      const endPoint = keypoints[endIdx];

      if (startPoint && endPoint && startPoint.x && startPoint.y && endPoint.x && endPoint.y) {
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(endPoint.x, endPoint.y);
        ctx.stroke();
      }
    });

    // Draw keypoints with larger size for detail view
    keypoints.forEach((keypoint) => {
      if (keypoint && keypoint.x && keypoint.y) {
        // Draw keypoint with gradient effect for detail view
        if (isDetailView) {
          const gradient = ctx.createRadialGradient(
            keypoint.x,
            keypoint.y,
            0,
            keypoint.x,
            keypoint.y,
            keypointRadius
          );
          gradient.addColorStop(0, keypointColor);
          gradient.addColorStop(0.7, keypointColor);
          gradient.addColorStop(1, "rgba(255, 255, 255, 0.3)");
          ctx.fillStyle = gradient;
        } else {
          ctx.fillStyle = keypointColor;
        }

        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, keypointRadius, 0, 2 * Math.PI);
        ctx.fill();

        // Add white border with thicker stroke for detail view
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = isDetailView ? 3 : 1;
        ctx.stroke();
      }
    });

    // Draw pose label with larger font for detail view
    if (keypoints[0] && keypoints[0].x && keypoints[0].y) {
      let label;
      if (selectedPersonRoles[index] === "defender") {
        label = "DEFENDER";
      } else if (selectedPersonRoles[index] === "attacker") {
        label = "ATTACKER";
      } else {
        label = "UNASSIGNED";
      }

      ctx.fillStyle = skeletonColor;
      ctx.font = labelFontSize;
      ctx.textAlign = "center";
      ctx.fillText(
        label,
        keypoints[0].x,
        keypoints[0].y - (isDetailView ? 30 : 20)
      );
    }
  });
};

// Draw bounding boxes and person IDs
export const drawBoundingBoxes = (ctx, poses, canvasWidth, canvasHeight, defenderSelected = null, selectedPersonRoles = {}) => {
  if (!poses || poses.length === 0) return;

  poses.forEach((pose, index) => {
    // Handle both API format (bbox array) and old format (bbox object)
    let bbox;
    if (Array.isArray(pose.bbox)) {
      // API format: [x0, y0, x1, y1] - top-left and bottom-right coordinates
      bbox = {
        x: pose.bbox[0],
        y: pose.bbox[1],
        width: pose.bbox[2] - pose.bbox[0],  // x1 - x0
        height: pose.bbox[3] - pose.bbox[1]  // y1 - y0
      };
    } else if (pose.bbox && typeof pose.bbox === 'object') {
      // Old format: {x, y, width, height}
      bbox = pose.bbox;
    } else {
      return; // No valid bbox
    }

    const personId = index + 1;

    // Draw bounding box
    ctx.strokeStyle = "#3b82f6"; // Blue color
    ctx.lineWidth = 3;
    ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);

    // Draw person ID background
    const idText = `Person ${personId}`;
    ctx.font = "bold 16px Arial";

    // Use purple background for role selection mode
    const isSelected = defenderSelected === index;
    ctx.fillStyle = isSelected ? "#7c3aed" : "#8b5cf6"; // Purple background
    const textMetrics = ctx.measureText(idText);
    const textWidth = textMetrics.width + 16;
    const textHeight = 24;

    ctx.fillRect(bbox.x, bbox.y - textHeight, textWidth, textHeight);

    // Draw person ID text
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.fillText(idText, bbox.x + 8, bbox.y - 6);

    // Draw role if assigned
    if (selectedPersonRoles[index]) {
      const role = selectedPersonRoles[index];
      const roleText = role === "defender" ? "DEFENDER" : "ATTACKER";
      const roleColor = role === "defender" ? "#22c55e" : "#ef4444";

      ctx.fillStyle = roleColor;
      ctx.font = "bold 14px Arial";
      const roleMetrics = ctx.measureText(roleText);
      const roleWidth = roleMetrics.width + 12;
      const roleHeight = 20;

      ctx.fillRect(
        bbox.x + bbox.width - roleWidth,
        bbox.y - textHeight - roleHeight,
        roleWidth,
        roleHeight
      );

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText(
        roleText,
        bbox.x + bbox.width - roleWidth / 2,
        bbox.y - textHeight - 6
      );
    }
  });
};
