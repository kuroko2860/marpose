import React, { useState } from "react";
import MotionAnalysisModal from "./MotionAnalysisModal";
import motionAnalysisService from "../services/motionAnalysisService";

const MotionAnalysisExample = ({
  capturedImages,
  extractedKeyFrames,
  currentPoses,
}) => {
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisType, setAnalysisType] = useState("");

  const analyzeCapturedImages = async () => {
    if (!capturedImages || capturedImages.length < 2) {
      alert("Cần ít nhất 2 ảnh đã chụp để phân tích chuyển động");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisType("Ảnh đã chụp");

    try {
      const analysis = await motionAnalysisService.analyzeCapturedImages(
        capturedImages,
        { martialArtsMode: true, normalizeTimestamps: true }
      );
      setAnalysisData(analysis);
      setShowAnalysisModal(true);
    } catch (error) {
      console.error("Motion analysis failed:", error);
      alert("Phân tích chuyển động thất bại: " + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeKeyFrames = async () => {
    if (!extractedKeyFrames || extractedKeyFrames.length < 2) {
      alert("Cần ít nhất 2 khung hình chính để phân tích chuyển động");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisType("Khung hình chính");

    try {
      const analysis = await motionAnalysisService.analyzeKeyFrames(
        extractedKeyFrames,
        { martialArtsMode: true, smoothPoses: true }
      );
      setAnalysisData(analysis);
      setShowAnalysisModal(true);
    } catch (error) {
      console.error("Motion analysis failed:", error);
      alert("Phân tích chuyển động thất bại: " + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeRealTimeMotion = async () => {
    if (!currentPoses || currentPoses.length === 0) {
      alert("Không có tư thế hiện tại để phân tích thời gian thực");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisType("Chuyển động thời gian thực");

    try {
      const analysis = await motionAnalysisService.analyzeRealTimeMotion(
        currentPoses,
        [], // No history for this example
        { martialArtsMode: true, timeWindow: 10000 } // 10 seconds
      );
      setAnalysisData(analysis);
      setShowAnalysisModal(true);
    } catch (error) {
      console.error("Motion analysis failed:", error);
      alert("Phân tích chuyển động thất bại: " + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
      <h2 className="text-xl font-semibold mb-4 flex items-center">
        <span className="text-2xl mr-3">🎯</span>
        Công cụ phân tích chuyển động
      </h2>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Captured Images Analysis */}
          <button
            onClick={analyzeCapturedImages}
            disabled={
              !capturedImages || capturedImages.length < 2 || isAnalyzing
            }
            className={`p-4 rounded-lg border-2 transition-all ${
              !capturedImages || capturedImages.length < 2 || isAnalyzing
                ? "border-gray-600 bg-gray-700/50 text-gray-400 cursor-not-allowed"
                : "border-blue-500 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
            }`}
          >
            <div className="text-center">
              <div className="text-3xl mb-2">📸</div>
              <h3 className="font-semibold mb-1">Ảnh đã chụp</h3>
              <p className="text-sm">
                {capturedImages?.length || 0} ảnh có sẵn
              </p>
            </div>
          </button>

          {/* Key Frames Analysis */}
          <button
            onClick={analyzeKeyFrames}
            disabled={
              !extractedKeyFrames ||
              extractedKeyFrames.length < 2 ||
              isAnalyzing
            }
            className={`p-4 rounded-lg border-2 transition-all ${
              !extractedKeyFrames ||
              extractedKeyFrames.length < 2 ||
              isAnalyzing
                ? "border-gray-600 bg-gray-700/50 text-gray-400 cursor-not-allowed"
                : "border-green-500 bg-green-500/10 text-green-400 hover:bg-green-500/20"
            }`}
          >
            <div className="text-center">
              <div className="text-3xl mb-2">🎯</div>
              <h3 className="font-semibold mb-1">Khung hình chính</h3>
              <p className="text-sm">
                {extractedKeyFrames?.length || 0} khung hình chính có sẵn
              </p>
            </div>
          </button>

          {/* Real-time Motion Analysis */}
          <button
            onClick={analyzeRealTimeMotion}
            disabled={!currentPoses || currentPoses.length === 0 || isAnalyzing}
            className={`p-4 rounded-lg border-2 transition-all ${
              !currentPoses || currentPoses.length === 0 || isAnalyzing
                ? "border-gray-600 bg-gray-700/50 text-gray-400 cursor-not-allowed"
                : "border-purple-500 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"
            }`}
          >
            <div className="text-center">
              <div className="text-3xl mb-2">⚡</div>
              <h3 className="font-semibold mb-1">Chuyển động thời gian thực</h3>
              <p className="text-sm">
                {currentPoses?.length || 0} tư thế được phát hiện
              </p>
            </div>
          </button>
        </div>

        {/* Analysis Status */}
        {isAnalyzing && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              <span className="text-blue-400">
                Đang phân tích {analysisType.toLowerCase()}...
              </span>
            </div>
          </div>
        )}

        {/* Usage Instructions */}
        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="font-semibold text-white mb-2">
            Cách sử dụng phân tích chuyển động:
          </h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>
              • <strong>Ảnh đã chụp:</strong> Phân tích chuyển động từ ảnh đã
              chụp thủ công
            </li>
            <li>
              • <strong>Khung hình chính:</strong> Phân tích chuyển động từ
              khung hình chính được trích xuất tự động
            </li>
            <li>
              • <strong>Chuyển động thời gian thực:</strong> Phân tích mẫu
              chuyển động hiện tại
            </li>
            <li>
              • Mỗi phân tích cung cấp phân loại kỹ thuật, chỉ số hiệu suất và
              gợi ý cải thiện
            </li>
          </ul>
        </div>
      </div>

      {/* Motion Analysis Modal */}
      <MotionAnalysisModal
        isOpen={showAnalysisModal}
        onClose={() => setShowAnalysisModal(false)}
        poseSequence={analysisData?.features ? [] : []} // This would be the actual pose sequence
        title={`Phân tích chuyển động - ${analysisType}`}
      />
    </div>
  );
};

export default MotionAnalysisExample;
