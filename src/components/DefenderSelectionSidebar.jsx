import React from "react";

const DefenderSelectionSidebar = ({
  isOpen,
  onClose,
  onSelectDefender,
  currentPoses,
  isWebcamActive,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-80 bg-gray-800/95 backdrop-blur-sm border-l border-gray-700 shadow-2xl pointer-events-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">
              🛡️ Chọn Người Phòng Thủ
            </h3>
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

          {/* Instructions */}
          <div className="mb-6 p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
            <p className="text-blue-300 text-sm">
              📹 Nhìn vào video bên trái và chọn người sẽ là người phòng thủ
              (defender) trong bài tập.
            </p>
          </div>

          {/* Pose List */}
          <div className="space-y-3">
            {currentPoses.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">👥</div>
                <p className="text-gray-400">
                  {isWebcamActive
                    ? "Đang chờ phát hiện người..."
                    : "Vui lòng bật camera để phát hiện người"}
                </p>
              </div>
            ) : (
              currentPoses.map((pose, index) => (
                <button
                  key={pose.track_id || index}
                  onClick={() => onSelectDefender(pose.track_id)}
                  className="w-full p-4 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 hover:border-green-500 transition-colors text-left group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center group-hover:bg-green-500 transition-colors">
                      <span className="text-white font-bold text-lg">
                        {pose.track_id || index + 1}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium">
                        Người {pose.track_id || index + 1}
                      </div>
                      <div className="text-gray-400 text-sm">
                        ID: {pose.track_id || `temp_${index}`}
                      </div>
                      <div className="text-gray-400 text-sm">
                        Độ tin cậy: {Math.round((pose.score || 1.0) * 100)}%
                      </div>
                    </div>
                    <div className="text-gray-400 group-hover:text-green-400 transition-colors">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 p-4 bg-gray-700/50 rounded-lg">
            <p className="text-gray-300 text-sm">
              💡 <strong>Mẹo:</strong> Người phòng thủ sẽ được hiển thị màu xanh
              lá, người tấn công sẽ hiển thị màu đỏ.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DefenderSelectionSidebar;
