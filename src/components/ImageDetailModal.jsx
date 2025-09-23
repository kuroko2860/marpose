import React from "react";

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
          <div className="w-2/3 flex flex-col">
            <div className="flex items-center justify-between p-4 bg-gray-800/50 border-b border-gray-700">
              <h4 className="text-lg font-semibold text-white">
                Ảnh với Skeleton Tư Thế
              </h4>
            </div>
            <div className="flex-1 bg-black overflow-auto">
              <img
                src={selectedImageDetail.image}
                alt="Captured pose with skeleton"
                className="object-scale-down"
                onLoad={(e) => {
                  // Draw pose skeleton on image load
                  const img = e.target;
                  const canvas = document.createElement("canvas");
                  const ctx = canvas.getContext("2d");

                  // Use original image dimensions for better quality
                  canvas.width = img.naturalWidth;
                  canvas.height = img.naturalHeight;

                  // Draw image
                  ctx.drawImage(img, 0, 0);

                  // Draw bounding boxes first
                  if (
                    selectedImageDetail.poses &&
                    selectedImageDetail.poses.length > 0
                  ) {
                    // For uploaded images, use role-based colors
                    if (
                      selectedImageDetail.source === "upload" &&
                      selectedPersonRoles
                    ) {
                      // Create poses with role information
                      const posesWithRoles = selectedImageDetail.poses.map(
                        (pose, index) => ({
                          ...pose,
                          role: selectedPersonRoles[index] || "unassigned",
                        })
                      );

                      onDrawBoundingBoxes(
                        ctx,
                        posesWithRoles,
                        canvas.width,
                        canvas.height,
                        null // No defenderTrackId for uploaded images
                      );

                      onDrawPoseSkeleton(
                        ctx,
                        posesWithRoles,
                        canvas.width,
                        canvas.height,
                        true, // Enable detail view mode
                        null // No defenderTrackId for uploaded images
                      );
                    } else {
                      // For webcam images, use defenderTrackId
                      onDrawBoundingBoxes(
                        ctx,
                        selectedImageDetail.poses,
                        canvas.width,
                        canvas.height,
                        defenderTrackId
                      );

                      onDrawPoseSkeleton(
                        ctx,
                        selectedImageDetail.poses,
                        canvas.width,
                        canvas.height,
                        true, // Enable detail view mode
                        defenderTrackId
                      );
                    }
                  }

                  // Replace image with canvas
                  img.style.display = "none";
                  img.parentNode.appendChild(canvas);
                  canvas.className =
                    "max-w-[700px] transition-transform duration-200";
                  canvas.style.transform = `scale(${imageZoom})`;
                  canvas.style.transformOrigin = "top left";
                }}
              />
            </div>
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

              {/* Server Analysis Results */}
              {selectedImageDetail.analysis && (
                <div className="bg-gray-700 rounded-lg p-4 mb-4">
                  <h5 className="font-semibold text-white mb-3">
                    🥋 Phân Tích Server
                  </h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Số tư thế:</span>
                      <span className="text-white">
                        {selectedImageDetail.poses?.length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Độ tin cậy:</span>
                      <span className="text-white">
                        {Math.round(
                          (selectedImageDetail.analysis.confidence || 0) * 100
                        )}
                        %
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Thời gian xử lý:</span>
                      <span className="text-white">
                        {selectedImageDetail.analysis.detection_time || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Mô hình:</span>
                      <span className="text-white">
                        {selectedImageDetail.analysis.model || "Server AI"}
                      </span>
                    </div>
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
                    🥋 Phân Tích Defender
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

              {/* Basic Info */}
              <div className="bg-gray-700 rounded-lg p-4 mb-4">
                <h5 className="font-semibold text-white mb-2">
                  Thông Tin Cơ Bản
                </h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Thời gian:</span>
                    <span className="text-white">
                      {new Date(selectedImageDetail.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Nguồn:</span>
                    <span className="text-white">
                      {selectedImageDetail.source === "upload"
                        ? "📁 Tải lên"
                        : "📸 Camera"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Số tư thế:</span>
                    <span className="text-white">
                      {selectedImageDetail.poses?.length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Phiên:</span>
                    <span className="text-white">
                      {selectedImageDetail.sessionId ? "✅" : "❌"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageDetailModal;
