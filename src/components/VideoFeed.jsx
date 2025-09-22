import React from "react";

const VideoFeed = ({
  isWebcamActive,
  isStreaming,
  videoRef,
  canvasRef,
  currentPoses = [],
}) => {
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
      <h2 className="text-xl font-semibold mb-4 flex items-center">
        <span
          className={`w-3 h-3 rounded-full mr-3 ${
            isWebcamActive ? "bg-green-500 animate-pulse" : "bg-gray-500"
          }`}
        ></span>
        Luồng Camera Trực Tiếp
        {isStreaming && (
          <span className="ml-2 bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs">
            🔄 Streaming
          </span>
        )}
      </h2>

      <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl h-96">
        {/* Always render video and canvas elements for refs */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          width={640}
          height={480}
          className="hidden"
        />
        <canvas
          ref={canvasRef}
          className={`w-full h-full object-cover ${
            !isWebcamActive ? "hidden" : ""
          }`}
        />

        {!isWebcamActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <div className="text-center">
              <div className="text-6xl mb-4">📹</div>
              <p className="text-gray-300 text-lg">
                Nhấn "Bật Camera" để bắt đầu
              </p>
            </div>
          </div>
        )}

        {/* Overlay Info */}
        {isWebcamActive && (
          <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2">
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400">Camera Đang Hoạt Động</span>
              </div>
              {currentPoses.length > 0 && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <span className="text-blue-400">
                    {currentPoses.length} Tư Thế Phát Hiện
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoFeed;
