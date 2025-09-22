import React from "react";

const CapturedImages = ({ capturedImages, onImageClick }) => {
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
      <h2 className="text-xl font-semibold mb-4 flex items-center">
        <span className="text-2xl mr-3">📸</span>
        Ảnh Đã Chụp
        {capturedImages.length > 0 && (
          <span className="ml-3 bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm">
            {capturedImages.length} đã chụp
          </span>
        )}
      </h2>

      {capturedImages.length === 0 ? (
        <div className="flex items-center justify-center h-96 bg-gray-800 rounded-xl">
          <div className="text-center">
            <div className="text-6xl mb-4">📷</div>
            <p className="text-gray-300 text-lg">Chưa có ảnh nào được chụp</p>
            <p className="text-gray-400 text-sm mt-2">
              Bật camera và nhấn "Chụp Ảnh"
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 max-h-96 overflow-y-auto">
          {capturedImages.map((capture) => (
            <div
              key={capture.id}
              className="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-blue-500 transition-colors cursor-pointer"
              onClick={() => onImageClick(capture)}
            >
              <div className="flex space-x-4">
                <img
                  src={capture.image}
                  alt="Captured pose"
                  className="w-24 h-24 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <div className="text-sm text-gray-300 mb-2">
                    {new Date(capture.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="text-sm text-blue-400 mb-1">
                    Tư thế phát hiện: {capture.poses?.length || 0}
                  </div>
                  {capture.analysis && (
                    <div className="text-xs text-gray-400 mb-1">
                      Độ tin cậy:{" "}
                      {Math.round((capture.analysis.confidence || 0) * 100)}%
                    </div>
                  )}
                  <div className="text-xs text-purple-400 mb-1">
                    {capture.source === "upload" ? "📁 Tải lên" : "📸 Camera"}
                    {capture.isProcessing && " - 🔄 Đang xử lý..."}
                    {capture.error && " - ❌ Lỗi"}
                  </div>
                  <div className="text-xs text-green-400">
                    Nhấn để xem chi tiết →
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CapturedImages;
