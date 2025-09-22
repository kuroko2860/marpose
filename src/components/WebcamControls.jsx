import React from "react";

const WebcamControls = ({
  isWebcamActive,
  isLoading,
  isCapturing,
  isApiConnected,
  isProcessingUpload,
  onStartWebcam,
  onStopWebcam,
  onCaptureImage,
  onFileUpload,
}) => {
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
      <h2 className="text-xl font-semibold mb-4 flex items-center">
        <span className="text-2xl mr-3">🎥</span>
        Điều Khiển Camera
      </h2>

      <div className="flex items-center space-x-4 mb-4">
        {!isWebcamActive ? (
          <button
            onClick={onStartWebcam}
            disabled={isLoading}
            className="bg-green-500 hover:bg-green-600 disabled:bg-gray-500 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Đang khởi động...</span>
              </>
            ) : (
              <>
                <span>📹</span>
                <span>Bật Camera</span>
              </>
            )}
          </button>
        ) : (
          <button
            onClick={onStopWebcam}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <span>⏹️</span>
            <span>Dừng Camera</span>
          </button>
        )}

        {isWebcamActive && (
          <button
            onClick={onCaptureImage}
            disabled={isCapturing || !isApiConnected}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            {isCapturing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Đang chụp...</span>
              </>
            ) : (
              <>
                <span>📸</span>
                <span>Chụp Ảnh</span>
              </>
            )}
          </button>
        )}

        {/* Upload Image Button */}
        <div className="relative">
          <input
            type="file"
            accept="image/*"
            onChange={onFileUpload}
            disabled={!isApiConnected || isProcessingUpload}
            className="hidden"
            id="image-upload"
          />
          <label
            htmlFor="image-upload"
            className={`${
              !isApiConnected || isProcessingUpload
                ? "bg-gray-500 cursor-not-allowed"
                : "bg-purple-500 hover:bg-purple-600 cursor-pointer"
            } text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2`}
          >
            {isProcessingUpload ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <span>📁</span>
                <span>Tải Ảnh Lên</span>
              </>
            )}
          </label>
        </div>
      </div>
    </div>
  );
};

export default WebcamControls;
