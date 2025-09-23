import React, { useState, useEffect } from "react";
import { analyzeMotion } from "../utils/motionAnalysis";

const MotionAnalysisModal = ({
  isOpen,
  onClose,
  poseSequence,
  title = "Motion Analysis",
}) => {
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && poseSequence && poseSequence.length > 0) {
      performAnalysis();
    }
  }, [isOpen, poseSequence]);

  const performAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      // Simulate processing time for better UX
      await new Promise((resolve) => setTimeout(resolve, 500));

      const result = analyzeMotion(poseSequence);
      setAnalysis(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getMotionTypeIcon = (motionType) => {
    const icons = {
      punching: "👊",
      kicking: "🦵",
      blocking: "🛡️",
      stance: "🧍",
      walking: "🚶",
      static_pose: "⏸️",
      general_movement: "🏃",
      unknown: "❓",
    };
    return icons[motionType] || "❓";
  };

  const getMotionTypeText = (motionType) => {
    const texts = {
      punching: "Đấm",
      kicking: "Đá",
      blocking: "Chặn",
      stance: "Tư thế",
      walking: "Đi bộ",
      static_pose: "Tư thế tĩnh",
      general_movement: "Chuyển động chung",
      unknown: "Không xác định",
    };
    return texts[motionType] || "Không xác định";
  };

  const getIntensityColor = (intensity) => {
    const colors = {
      low: "text-green-400",
      medium: "text-yellow-400",
      high: "text-red-400",
    };
    return colors[intensity] || "text-gray-400";
  };

  const getStabilityColor = (stability) => {
    const colors = {
      stable: "text-green-400",
      moderately_stable: "text-yellow-400",
      unstable: "text-red-400",
    };
    return colors[stability] || "text-gray-400";
  };

  const getSymmetryColor = (symmetry) => {
    const colors = {
      symmetric: "text-green-400",
      moderately_symmetric: "text-yellow-400",
      asymmetric: "text-red-400",
    };
    return colors[symmetry] || "text-gray-400";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-gray-800 rounded-2xl p-8 max-w-4xl w-full mx-4 border border-gray-700 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <span className="text-3xl mr-3">🎯</span>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        {isAnalyzing ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-300 text-lg">
              Đang phân tích mẫu chuyển động...
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Đang xử lý {poseSequence?.length || 0} khung hình tư thế
            </p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">⚠️</div>
            <p className="text-red-400 text-lg mb-2">Phân tích thất bại</p>
            <p className="text-gray-300">{error}</p>
          </div>
        ) : analysis ? (
          <div className="space-y-6">
            {/* Motion Type */}
            <div className="bg-gray-700 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <span className="text-2xl mr-3">
                  {getMotionTypeIcon(analysis.motionType)}
                </span>
                Phân loại chuyển động
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-300 text-sm mb-1">
                    Chuyển động phát hiện:
                  </p>
                  <p className="text-white text-lg font-medium">
                    {getMotionTypeText(analysis.motionType)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-300 text-sm mb-1">Độ tin cậy:</p>
                  <p className="text-blue-400 text-lg font-medium">
                    {Math.round(analysis.confidence * 100)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Motion Characteristics */}
            {analysis.patterns && (
              <div className="bg-gray-700 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-white mb-4">
                  Đặc điểm chuyển động
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-gray-300 text-sm mb-1">Cường độ</p>
                    <p
                      className={`text-lg font-medium capitalize ${getIntensityColor(
                        analysis.patterns.intensity
                      )}`}
                    >
                      {analysis.patterns.intensity === "high"
                        ? "Cao"
                        : analysis.patterns.intensity === "medium"
                        ? "Trung bình"
                        : "Thấp"}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-300 text-sm mb-1">Ổn định</p>
                    <p
                      className={`text-lg font-medium capitalize ${getStabilityColor(
                        analysis.patterns.stability
                      )}`}
                    >
                      {analysis.patterns.stability === "stable"
                        ? "Ổn định"
                        : analysis.patterns.stability === "moderately_stable"
                        ? "Khá ổn định"
                        : "Không ổn định"}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-300 text-sm mb-1">Đối xứng</p>
                    <p
                      className={`text-lg font-medium capitalize ${getSymmetryColor(
                        analysis.patterns.symmetry
                      )}`}
                    >
                      {analysis.patterns.symmetry === "symmetric"
                        ? "Đối xứng"
                        : analysis.patterns.symmetry === "moderately_symmetric"
                        ? "Khá đối xứng"
                        : "Không đối xứng"}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-300 text-sm mb-1">Mượt mà</p>
                    <p className="text-lg font-medium capitalize text-blue-400">
                      {analysis.patterns.smoothness === "smooth"
                        ? "Mượt mà"
                        : analysis.patterns.smoothness === "moderate"
                        ? "Trung bình"
                        : "Gập ghềnh"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Motion Metrics */}
            {analysis.patterns?.motionMetrics && (
              <div className="bg-gray-700 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-white mb-4">
                  Chỉ số chuyển động
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p className="text-gray-300 text-sm mb-1">
                      Cường độ chuyển động trung bình
                    </p>
                    <p className="text-white text-lg font-medium">
                      {analysis.patterns.motionMetrics.averageMotionMagnitude.toFixed(
                        2
                      )}{" "}
                      px/khung
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-300 text-sm mb-1">Vận tốc đỉnh</p>
                    <p className="text-white text-lg font-medium">
                      {analysis.patterns.motionMetrics.peakVelocity.toFixed(2)}{" "}
                      px/s
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-300 text-sm mb-1">Điểm ổn định</p>
                    <p className="text-white text-lg font-medium">
                      {Math.round(
                        analysis.patterns.motionMetrics.stabilityScore * 100
                      )}
                      %
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-300 text-sm mb-1">
                      Phương sai chuyển động
                    </p>
                    <p className="text-white text-lg font-medium">
                      {analysis.patterns.motionMetrics.motionVariance.toFixed(
                        2
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-300 text-sm mb-1">Tổng số khung</p>
                    <p className="text-white text-lg font-medium">
                      {analysis.patterns.motionMetrics.totalFrames}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-300 text-sm mb-1">
                      Vận tốc trung bình
                    </p>
                    <p className="text-white text-lg font-medium">
                      {analysis.patterns.motionMetrics.averageVelocity.toFixed(
                        2
                      )}{" "}
                      px/s
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Dominant Joints */}
            {analysis.patterns?.dominantJoints &&
              analysis.patterns.dominantJoints.length > 0 && (
                <div className="bg-gray-700 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-white mb-4">
                    Khớp hoạt động nhiều nhất
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {analysis.patterns.dominantJoints.map((jointIndex, idx) => {
                      const jointNames = {
                        0: "Mũi",
                        1: "Mắt trái",
                        2: "Mắt phải",
                        3: "Tai trái",
                        4: "Tai phải",
                        5: "Vai trái",
                        6: "Vai phải",
                        7: "Khuỷu tay trái",
                        8: "Khuỷu tay phải",
                        9: "Cổ tay trái",
                        10: "Cổ tay phải",
                        11: "Hông trái",
                        12: "Hông phải",
                        13: "Đầu gối trái",
                        14: "Đầu gối phải",
                        15: "Mắt cá chân trái",
                        16: "Mắt cá chân phải",
                      };
                      return (
                        <span
                          key={jointIndex}
                          className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm font-medium"
                        >
                          #{idx + 1}:{" "}
                          {jointNames[jointIndex] || `Khớp ${jointIndex}`}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Recommendations */}
            {analysis.recommendations &&
              analysis.recommendations.length > 0 && (
                <div className="bg-gray-700 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-white mb-4">
                    Khuyến nghị
                  </h3>
                  <ul className="space-y-2">
                    {analysis.recommendations.map((recommendation, index) => (
                      <li
                        key={index}
                        className="flex items-start space-x-2 text-gray-300"
                      >
                        <span className="text-blue-400 mt-1">•</span>
                        <span>{recommendation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Data Summary */}
            <div className="bg-gray-700 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4">
                Tóm tắt dữ liệu
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-300 mb-1">Độ dài chuỗi tư thế:</p>
                  <p className="text-white">{poseSequence.length} khung</p>
                </div>
                <div>
                  <p className="text-gray-300 mb-1">Thời gian phân tích:</p>
                  <p className="text-white">
                    {poseSequence.length > 0 &&
                    poseSequence[poseSequence.length - 1].timestamp &&
                    poseSequence[0].timestamp
                      ? `${(
                          (poseSequence[poseSequence.length - 1].timestamp -
                            poseSequence[0].timestamp) /
                          1000
                        ).toFixed(2)}s`
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-300 mb-1">Chất lượng dữ liệu:</p>
                  <p className="text-white">
                    {analysis.confidence > 0.8
                      ? "Cao"
                      : analysis.confidence > 0.6
                      ? "Trung bình"
                      : "Thấp"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-300 mb-1">Trạng thái phân tích:</p>
                  <p className="text-green-400">Hoàn thành</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-gray-300 text-lg">Không có dữ liệu phân tích</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-3 rounded-lg transition-colors font-semibold"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default MotionAnalysisModal;
