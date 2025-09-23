import React, { useState, useEffect, useRef } from "react";
import { analyzePoseCorrectness } from "../utils/trainingPoseDetection";
import { trainingTypes } from "../config/const";

const SimplifiedImageDetailModal = ({
  isOpen,
  onClose,
  selectedImageDetail,
  onDrawPoseSkeleton,
  onDrawBoundingBoxes,
  showRoleSelection,
  defenderSelected,
  selectedPersonRoles,
  onSelectDefender,
}) => {
  const [poseAnalysis, setPoseAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (isOpen && selectedImageDetail) {
      analyzePose();
    }
  }, [isOpen, selectedImageDetail]);

  useEffect(() => {
    if (isOpen && selectedImageDetail && defenderSelected !== null) {
      analyzePose();
      // Redraw overlays with new colors
      drawImageOverlays();
    }
  }, [defenderSelected]);

  useEffect(() => {
    if (isOpen && selectedImageDetail) {
      // Redraw overlays when modal opens or image changes
      drawImageOverlays();
    } else if (!isOpen) {
      // Clear analysis results when modal closes
      setPoseAnalysis(null);
      setIsAnalyzing(false);
    }
  }, [isOpen, selectedImageDetail]);

  // Draw overlays on the image
  const drawImageOverlays = () => {
    if (!canvasRef.current || !selectedImageDetail) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw image
      ctx.drawImage(img, 0, 0);

      // Draw poses with appropriate colors
      if (selectedImageDetail.poses && selectedImageDetail.poses.length > 0) {
        let posesToDraw = selectedImageDetail.poses;

        // For both captured and uploaded images, add role information if defender is selected
        if (defenderSelected !== null) {
          posesToDraw = selectedImageDetail.poses.map((pose) => ({
            ...pose,
            role: pose.track_id === defenderSelected ? "defender" : "attacker",
          }));
        }

        // Draw bounding boxes and skeletons
        // Use null for defenderTrackId to show default colors (purple) when no defender selected
        // When defender is selected, the poses already have role information
        onDrawBoundingBoxes(
          ctx,
          posesToDraw,
          canvas.width,
          canvas.height,
          null // Always use null to let drawing utils handle colors based on role property
        );
        onDrawPoseSkeleton(
          ctx,
          posesToDraw,
          canvas.width,
          canvas.height,
          true,
          null // Always use null to let drawing utils handle colors based on role property
        );
      }
    };

    img.src = selectedImageDetail.image;
  };

  const analyzePose = async () => {
    if (!selectedImageDetail) return;

    // Wait for defender selection for both captured and uploaded images
    if (!defenderSelected) {
      return;
    }

    setIsAnalyzing(true);
    try {
      // Simulate processing time for better UX
      await new Promise((resolve) => setTimeout(resolve, 500));

      let poseToAnalyze;
      let trainingTypeId;

      // For both captured and uploaded images, analyze the selected defender's pose
      if (defenderSelected !== null && selectedImageDetail.poses) {
        // Find pose by track_id
        poseToAnalyze = selectedImageDetail.poses.find(
          (pose) => pose.track_id === defenderSelected
        );
        trainingTypeId = selectedImageDetail.trainingTypeId || "1"; // Default to training type 1

        if (!poseToAnalyze) {
          throw new Error("Defender pose not found");
        }
      } else {
        throw new Error("No defender selected for analysis");
      }

      if (!poseToAnalyze) {
        throw new Error("No pose data available for analysis");
      }

      // Find attacker pose for relative analysis
      let attackerPose = null;
      if (selectedImageDetail.poses && selectedImageDetail.poses.length > 1) {
        // Find the first pose that is not the defender
        attackerPose = selectedImageDetail.poses.find(
          (pose) => pose.track_id !== defenderSelected
        );
      }

      const analysis = analyzePoseCorrectness(
        poseToAnalyze,
        trainingTypeId,
        attackerPose
      );
      setPoseAnalysis(analysis);
    } catch (error) {
      console.error("Pose analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isOpen || !selectedImageDetail) return null;

  const trainingType = trainingTypes.find(
    (type) => type.id === selectedImageDetail.trainingTypeId
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-white">
              📊 Phân tích tư thế
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {trainingType?.name || "Không xác định"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Image Display */}
          <div className="w-2/3 flex justify-center items-center p-6">
            <div className="relative">
              <img
                src={selectedImageDetail.image}
                alt="Captured pose"
                className="max-w-full max-h-full object-contain rounded-lg"
                onLoad={() => {
                  // Draw overlays when image loads
                  drawImageOverlays();
                }}
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 max-w-full max-h-full object-contain rounded-lg"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>

          {/* Analysis Panel */}
          <div className="w-1/3 border-l border-gray-700 p-6 overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-4">
              Kết quả phân tích
            </h3>

            {/* Role Selection for Both Captured and Uploaded Images */}
            {showRoleSelection && (
              <div className="mb-6">
                <h4 className="text-md font-medium text-white mb-3">
                  🛡️ Chọn người phòng thủ:
                </h4>
                <div className="space-y-2">
                  {selectedImageDetail.poses?.map((pose, index) => (
                    <button
                      key={index}
                      onClick={() => onSelectDefender(pose.track_id)}
                      className="w-full p-3 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 hover:border-green-500 transition-colors text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-sm">
                            {index + 1}
                          </span>
                        </div>
                        <div>
                          <div className="text-white font-medium">
                            Người {index + 1}
                          </div>
                          <div className="text-gray-400 text-sm">
                            ID: {pose.track_id || `temp_${index}`}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-gray-400 text-sm mt-3">
                  💡 Chọn người sẽ được phân tích tư thế phòng thủ
                </p>
              </div>
            )}

            {isAnalyzing ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-400">Đang phân tích...</span>
              </div>
            ) : poseAnalysis ? (
              <div className="space-y-4">
                {/* Overall Status */}
                <div
                  className={`p-4 rounded-lg ${
                    poseAnalysis.isCorrect
                      ? "bg-green-500/20 border border-green-500/30"
                      : "bg-red-500/20 border border-red-500/30"
                  }`}
                >
                  <div className="flex items-center mb-2">
                    <span className="text-2xl mr-2">
                      {poseAnalysis.isCorrect ? "✅" : "❌"}
                    </span>
                    <span
                      className={`font-semibold ${
                        poseAnalysis.isCorrect
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {poseAnalysis.isCorrect
                        ? "Tư thế đúng"
                        : "Tư thế cần điều chỉnh"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300">
                    Độ chính xác: {(poseAnalysis.confidence * 100).toFixed(1)}%
                  </p>
                </div>

                {/* Detailed Feedback */}
                <div className="space-y-3">
                  <h4 className="text-md font-medium text-white">
                    Chi tiết đánh giá:
                  </h4>
                  {Object.entries(poseAnalysis.feedback).map(
                    ([key, feedback]) => (
                      <div key={key} className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-sm text-gray-300">{feedback}</p>
                      </div>
                    )
                  )}
                </div>

                {/* Metrics */}
                {poseAnalysis.metrics && (
                  <div className="space-y-3">
                    <h4 className="text-md font-medium text-white">
                      Thông số kỹ thuật:
                    </h4>
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      {Object.entries(poseAnalysis.metrics).map(
                        ([key, value]) => (
                          <div
                            key={key}
                            className="flex justify-between text-sm mb-1"
                          >
                            <span className="text-gray-400 capitalize">
                              {key.replace(/([A-Z])/g, " $1").trim()}:
                            </span>
                            <span className="text-white">
                              {typeof value === "number"
                                ? value.toFixed(2)
                                : value.toString()}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Training Type Info */}
                {trainingType && (
                  <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3">
                    <h4 className="text-md font-medium text-blue-400 mb-2">
                      Thông tin bài tập
                    </h4>
                    <p className="text-sm text-gray-300">
                      {trainingType.description}
                    </p>
                  </div>
                )}
              </div>
            ) : !defenderSelected ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">🛡️</div>
                <p className="text-gray-400">
                  Vui lòng chọn người phòng thủ để phân tích
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400">Không có dữ liệu phân tích</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimplifiedImageDetailModal;
