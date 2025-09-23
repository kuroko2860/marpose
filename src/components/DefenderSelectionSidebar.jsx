import React, { useState, useEffect } from "react";

const DefenderSelectionSidebar = ({
  isOpen,
  onClose,
  onSelectDefender,
  currentPoses,
  isWebcamActive,
}) => {
  const [selectedDefenderId, setSelectedDefenderId] = useState(null);

  // Auto-select first pose if only one person detected
  useEffect(() => {
    if (currentPoses && currentPoses.length === 1 && !selectedDefenderId) {
      setSelectedDefenderId(currentPoses[0].track_id);
    }
  }, [currentPoses, selectedDefenderId]);

  const handleConfirm = () => {
    if (selectedDefenderId) {
      onSelectDefender(selectedDefenderId);
      onClose();
    }
  };

  const handleCancel = () => {
    setSelectedDefenderId(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 right-0 h-full w-80 bg-gray-800/95 backdrop-blur-sm border-l border-gray-700 z-40 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center">
            <span className="text-2xl mr-3">🛡️</span>
            Chọn Người Phòng Thủ
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <span className="text-xl">×</span>
          </button>
        </div>
        <p className="text-gray-300 text-sm">
          Chọn người sẽ là người phòng thủ trong buổi tập
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {!isWebcamActive ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📹</div>
            <p className="text-gray-300 mb-2">Camera chưa được bật</p>
            <p className="text-gray-400 text-sm">
              Vui lòng bật camera trước khi chọn người phòng thủ
            </p>
          </div>
        ) : !currentPoses || currentPoses.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">👤</div>
            <p className="text-gray-300 mb-2">Chưa phát hiện người</p>
            <p className="text-gray-400 text-sm">
              Hãy đứng trước camera để hệ thống phát hiện
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-gray-300 mb-4">
              Phát hiện {currentPoses.length} người. Chọn người phòng thủ:
            </div>

            {currentPoses.map((pose, index) => (
              <div
                key={pose.track_id}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedDefenderId === pose.track_id
                    ? "border-green-500 bg-green-500/10"
                    : "border-gray-600 bg-gray-700/50 hover:border-gray-500"
                }`}
                onClick={() => setSelectedDefenderId(pose.track_id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-4 h-4 rounded-full ${
                        selectedDefenderId === pose.track_id
                          ? "bg-green-500"
                          : "bg-gray-500"
                      }`}
                    />
                    <div>
                      <div className="text-white font-medium">
                        Người {index + 1} (ID: {pose.track_id})
                      </div>
                      <div className="text-sm text-gray-400">
                        {selectedDefenderId === pose.track_id
                          ? "🛡️ Người phòng thủ"
                          : "⚔️ Người tấn công"}
                      </div>
                    </div>
                  </div>
                  {selectedDefenderId === pose.track_id && (
                    <div className="text-green-400 text-xl">✓</div>
                  )}
                </div>
              </div>
            ))}

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-4">
              <div className="flex items-center space-x-2 text-blue-400 text-sm">
                <span>💡</span>
                <span>
                  Người phòng thủ sẽ được hiển thị màu xanh lá, người tấn công
                  màu đỏ
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-700">
        <div className="flex space-x-3">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedDefenderId || !isWebcamActive}
            className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
};

export default DefenderSelectionSidebar;
