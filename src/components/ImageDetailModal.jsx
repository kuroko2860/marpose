import React, { useState, useEffect } from "react";
import { analyzeMotion } from "../utils/motionAnalysis";
import MotionSequencePlayer from "./MotionSequencePlayer";

const ImageDetailModal = ({
  isOpen,
  selectedImageDetail,
  imageZoom,
  onClose,
  onDrawPoseSkeleton,
  onDrawBoundingBoxes,
  defenderTrackId,
  showRoleSelection,
  defenderSelected,
  selectedPersonRoles,
  onSelectDefender,
}) => {
  const [motionAnalysis, setMotionAnalysis] = useState(null);
  const [isAnalyzingMotion, setIsAnalyzingMotion] = useState(false);
  const [motionAnalysisError, setMotionAnalysisError] = useState(null);

  // Analyze motion when modal opens and has motion sequence
  useEffect(() => {
    if (
      isOpen &&
      selectedImageDetail?.motionSequence &&
      selectedImageDetail.motionSequence.length > 1
    ) {
      analyzeMotionSequence();
    } else {
      setMotionAnalysis(null);
      setMotionAnalysisError(null);
    }
  }, [isOpen, selectedImageDetail]);

  const analyzeMotionSequence = async () => {
    if (
      !selectedImageDetail?.motionSequence ||
      selectedImageDetail.motionSequence.length < 2
    ) {
      return;
    }

    setIsAnalyzingMotion(true);
    setMotionAnalysisError(null);

    try {
      // Simulate processing time for better UX
      await new Promise((resolve) => setTimeout(resolve, 300));

      const analysis = analyzeMotion(
        selectedImageDetail.motionSequence,
        selectedImageDetail.keyFrameType
      );
      setMotionAnalysis(analysis);
    } catch (error) {
      setMotionAnalysisError(error.message);
    } finally {
      setIsAnalyzingMotion(false);
    }
  };

  if (!isOpen || !selectedImageDetail) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50">
      <div className="h-full w-full flex flex-col">
        {/* Header */}
        <div className="bg-gray-800/95 backdrop-blur-sm border-b border-gray-700 p-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">📸 Chi Tiết Ảnh Chụp</h3>
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Đóng
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Image Section - Half Screen */}
          <div className="w-2/3 flex justify-center items-center">
            {selectedImageDetail.motionSequence &&
            selectedImageDetail.motionSequence.length > 1 ? (
              <MotionSequencePlayer
                motionSequence={selectedImageDetail.motionSequence}
                poses={selectedImageDetail.poses}
                onDrawPoseSkeleton={onDrawPoseSkeleton}
                onDrawBoundingBoxes={onDrawBoundingBoxes}
                defenderTrackId={defenderTrackId}
              />
            ) : (
              <img
                src={selectedImageDetail.image}
                alt="Captured pose with skeleton"
                className="object-scale-down"
              />
            )}
          </div>

          {/* Analysis Section - Half Screen */}
          <div className="w-1/3 flex flex-col bg-gray-800/30">
            <div className="p-4 bg-gray-800/50 border-b border-gray-700">
              <h4 className="text-lg font-semibold text-white">
                Phân Tích & Phản Hồi
              </h4>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {/* Processing Status */}
              {selectedImageDetail.isProcessing && (
                <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-4">
                  <div className="flex items-center space-x-2 text-yellow-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
                    <span className="font-medium">
                      Đang xử lý trên server...
                    </span>
                  </div>
                </div>
              )}

              {/* Error Status */}
              {selectedImageDetail.error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4">
                  <div className="flex items-center space-x-2 text-red-400">
                    <span>❌</span>
                    <span className="font-medium">
                      Lỗi: {selectedImageDetail.error}
                    </span>
                  </div>
                </div>
              )}

              {/* Role Selection for Uploaded Images */}
              {showRoleSelection &&
                selectedImageDetail.poses &&
                selectedImageDetail.poses.length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-4 mb-4">
                    <h5 className="font-semibold text-white mb-3">
                      🛡️ Chọn Defender
                    </h5>
                    <div className="mb-3 p-2 bg-purple-500/20 border border-purple-500/50 rounded text-sm text-purple-400">
                      💜 Chọn người nào là Defender. Người còn lại sẽ tự động là
                      Attacker.
                    </div>
                    <div className="space-y-3">
                      {selectedImageDetail.poses.map((pose, index) => (
                        <div
                          key={index}
                          className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                            defenderSelected === index
                              ? "border-green-500 bg-green-500/10"
                              : "border-gray-600 hover:border-purple-500"
                          }`}
                          onClick={() => onSelectDefender(index)}
                        >
                          <div className="flex items-center space-x-2">
                            <div
                              className={`w-4 h-4 rounded-full ${
                                defenderSelected === index
                                  ? "bg-green-500"
                                  : "bg-purple-500"
                              }`}
                            ></div>
                            <div className="text-sm text-gray-300">
                              Person {index + 1} - ID {pose.track_id}
                            </div>
                            {defenderSelected === index && (
                              <div className="text-xs text-green-400 font-medium">
                                ✅ Selected as Defender
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Defender Analysis */}
              {selectedImageDetail.defenderAnalysis && (
                <div className="bg-gray-700 rounded-lg p-4 mb-4">
                  <h5 className="font-semibold text-white mb-3">
                    🥋 Phân tích người phòng thủ
                  </h5>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">
                        Loại huấn luyện:
                      </span>
                      <span className="text-sm text-blue-400 font-medium">
                        {selectedImageDetail.defenderAnalysis.trainingType}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">
                        Hành động Defender (AI):
                      </span>
                      <span className="text-sm text-green-400 font-medium">
                        {selectedImageDetail.defenderAnalysis.defenderAction ===
                        "block"
                          ? "Chặn"
                          : selectedImageDetail.defenderAnalysis
                              .defenderAction === "dodge"
                          ? "Né"
                          : selectedImageDetail.defenderAnalysis
                              .defenderAction === "kick"
                          ? "Đá"
                          : selectedImageDetail.defenderAnalysis
                              .defenderAction === "punch"
                          ? "Đấm"
                          : "Không xác định"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">Độ tin cậy:</span>
                      <span className="text-sm text-blue-400 font-medium">
                        {Math.round(
                          selectedImageDetail.defenderAnalysis
                            .defenderConfidence * 100
                        )}
                        %
                      </span>
                    </div>
                    {selectedImageDetail.defenderAnalysis.attackerActions &&
                      selectedImageDetail.defenderAnalysis.attackerActions
                        .length > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-300">
                            Hành động Attacker (AI):
                          </span>
                          <span className="text-sm text-red-400 font-medium">
                            {selectedImageDetail.defenderAnalysis.attackerActions
                              .map((action) =>
                                action.action === "kick"
                                  ? "Đá"
                                  : action.action === "punch"
                                  ? "Đấm"
                                  : action.action === "block"
                                  ? "Chặn"
                                  : action.action === "dodge"
                                  ? "Né"
                                  : "Không xác định"
                              )
                              .join(", ")}
                          </span>
                        </div>
                      )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">Điểm số:</span>
                      <span
                        className={`text-sm font-medium ${
                          selectedImageDetail.defenderAnalysis.score >= 0.8
                            ? "text-green-400"
                            : selectedImageDetail.defenderAnalysis.score >= 0.5
                            ? "text-yellow-400"
                            : "text-red-400"
                        }`}
                      >
                        {Math.round(
                          selectedImageDetail.defenderAnalysis.score * 100
                        )}
                        %
                      </span>
                    </div>
                    <div className="mt-3 p-3 bg-gray-600 rounded-lg">
                      <div className="text-sm text-white font-medium mb-2">
                        Phản hồi:
                      </div>
                      <div className="text-sm text-gray-300">
                        {selectedImageDetail.defenderAnalysis.feedback}
                      </div>
                    </div>
                    {selectedImageDetail.defenderAnalysis.details &&
                      selectedImageDetail.defenderAnalysis.details.length >
                        0 && (
                        <div className="mt-3">
                          <div className="text-sm text-white font-medium mb-2">
                            Chi tiết:
                          </div>
                          <ul className="space-y-1">
                            {selectedImageDetail.defenderAnalysis.details.map(
                              (detail, index) => (
                                <li
                                  key={index}
                                  className="text-sm text-gray-300 flex items-center"
                                >
                                  <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                                  {detail}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                  </div>
                </div>
              )}

              {/* Motion Analysis Section */}
              {selectedImageDetail.motionSequence &&
                selectedImageDetail.motionSequence.length > 1 && (
                  <div className="bg-gray-700 rounded-lg p-4 mb-4">
                    <h5 className="font-semibold text-white mb-3 flex items-center">
                      <span className="text-xl mr-2">🎯</span>
                      Phân tích chuyển động
                      {isAnalyzingMotion && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 ml-2"></div>
                      )}
                    </h5>

                    {isAnalyzingMotion ? (
                      <div className="text-center py-4">
                        <p className="text-gray-300 text-sm">
                          Đang phân tích chuỗi chuyển động...
                        </p>
                        <p className="text-gray-400 text-xs mt-1">
                          {selectedImageDetail.motionSequence.length} khung
                        </p>
                      </div>
                    ) : motionAnalysisError ? (
                      <div className="text-center py-4">
                        <p className="text-red-400 text-sm">
                          Phân tích thất bại: {motionAnalysisError}
                        </p>
                      </div>
                    ) : motionAnalysis ? (
                      <div className="space-y-3">
                        {/* Motion Type */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-300">
                            Loại chuyển động:
                          </span>
                          <span className="text-sm text-white font-medium capitalize">
                            {motionAnalysis.motionType === "punching"
                              ? "Đấm"
                              : motionAnalysis.motionType === "kicking"
                              ? "Đá"
                              : motionAnalysis.motionType === "blocking"
                              ? "Chặn"
                              : motionAnalysis.motionType === "stance"
                              ? "Tư thế"
                              : motionAnalysis.motionType === "walking"
                              ? "Đi bộ"
                              : motionAnalysis.motionType === "static_pose"
                              ? "Tư thế tĩnh"
                              : motionAnalysis.motionType === "general_movement"
                              ? "Chuyển động chung"
                              : "Không xác định"}
                          </span>
                        </div>

                        {/* Confidence */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-300">
                            Độ tin cậy:
                          </span>
                          <span className="text-sm text-blue-400 font-medium">
                            {Math.round(motionAnalysis.confidence * 100)}%
                          </span>
                        </div>

                        {/* Motion Characteristics */}
                        {motionAnalysis.patterns && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-300">
                                Cường độ:
                              </span>
                              <span
                                className={`text-sm font-medium capitalize ${
                                  motionAnalysis.patterns.intensity === "high"
                                    ? "text-red-400"
                                    : motionAnalysis.patterns.intensity ===
                                      "medium"
                                    ? "text-yellow-400"
                                    : "text-green-400"
                                }`}
                              >
                                {motionAnalysis.patterns.intensity === "high"
                                  ? "Cao"
                                  : motionAnalysis.patterns.intensity ===
                                    "medium"
                                  ? "Trung bình"
                                  : "Thấp"}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-300">
                                Ổn định:
                              </span>
                              <span
                                className={`text-sm font-medium capitalize ${
                                  motionAnalysis.patterns.stability === "stable"
                                    ? "text-green-400"
                                    : motionAnalysis.patterns.stability ===
                                      "moderately_stable"
                                    ? "text-yellow-400"
                                    : "text-red-400"
                                }`}
                              >
                                {motionAnalysis.patterns.stability === "stable"
                                  ? "Ổn định"
                                  : motionAnalysis.patterns.stability ===
                                    "moderately_stable"
                                  ? "Khá ổn định"
                                  : "Không ổn định"}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-300">
                                Đối xứng:
                              </span>
                              <span
                                className={`text-sm font-medium capitalize ${
                                  motionAnalysis.patterns.symmetry ===
                                  "symmetric"
                                    ? "text-green-400"
                                    : motionAnalysis.patterns.symmetry ===
                                      "moderately_symmetric"
                                    ? "text-yellow-400"
                                    : "text-red-400"
                                }`}
                              >
                                {motionAnalysis.patterns.symmetry ===
                                "symmetric"
                                  ? "Đối xứng"
                                  : motionAnalysis.patterns.symmetry ===
                                    "moderately_symmetric"
                                  ? "Khá đối xứng"
                                  : "Không đối xứng"}
                              </span>
                            </div>
                          </>
                        )}

                        {/* Motion Metrics */}
                        {motionAnalysis.patterns?.motionMetrics && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-300">
                                Vận tốc đỉnh:
                              </span>
                              <span className="text-sm text-white">
                                {motionAnalysis.patterns.motionMetrics.peakVelocity.toFixed(
                                  1
                                )}{" "}
                                px/s
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-300">
                                Cường độ chuyển động:
                              </span>
                              <span className="text-sm text-white">
                                {motionAnalysis.patterns.motionMetrics.averageMotionMagnitude.toFixed(
                                  1
                                )}{" "}
                                px/khung
                              </span>
                            </div>
                          </>
                        )}

                        {/* Recommendations */}
                        {motionAnalysis.recommendations &&
                          motionAnalysis.recommendations.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-600">
                              <div className="text-sm text-white font-medium mb-2">
                                Khuyến nghị:
                              </div>
                              <ul className="space-y-1">
                                {motionAnalysis.recommendations
                                  .slice(0, 2)
                                  .map((recommendation, index) => (
                                    <li
                                      key={index}
                                      className="text-xs text-gray-300 flex items-start"
                                    >
                                      <span className="text-blue-400 mt-1 mr-1">
                                        •
                                      </span>
                                      <span>{recommendation}</span>
                                    </li>
                                  ))}
                              </ul>
                            </div>
                          )}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-gray-400 text-sm">
                          Không có phân tích chuyển động
                        </p>
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageDetailModal;
