import React from "react";

const ConnectionStatus = ({ isApiConnected, isStreaming, onReconnect }) => {
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-4 border border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={`w-3 h-3 rounded-full ${
              isApiConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
            }`}
          ></div>
          <span className="text-sm">
            API Server: {isApiConnected ? "Đã Kết Nối" : "Mất Kết Nối"}
          </span>
          {isStreaming && (
            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
              🔄 Streaming
            </span>
          )}
        </div>
        <div className="flex space-x-2">
          {!isApiConnected && (
            <button
              onClick={onReconnect}
              className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              Kết Nối Lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectionStatus;
