import React from "react";

const SessionControls = ({
  currentSession,
  onShowTrainingTypeSelection,
  onResetSession,
}) => {
  return (
    <div className="flex items-center space-x-4">
      {!currentSession ? (
        <button
          onClick={onShowTrainingTypeSelection}
          className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
        >
          <span>🏁</span>
          <span>Bắt Đầu Phiên Huấn Luyện</span>
        </button>
      ) : (
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-orange-400">
            <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
            <span className="text-sm">{currentSession.typeName}</span>
          </div>
          <button
            onClick={onResetSession}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Đặt Lại Phiên
          </button>
        </div>
      )}
    </div>
  );
};

export default SessionControls;
