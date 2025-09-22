import React from "react";
import { trainingTypes } from "./const";

const TrainingTypeModal = ({ isOpen, onClose, onSelectTrainingType }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-center text-white">
          🏆 Chọn Bài Huấn Luyện
        </h3>

        <div className="space-y-3 mb-6">
          {trainingTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => onSelectTrainingType(type.id)}
              className="w-full p-4 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 hover:border-orange-500 transition-colors text-left"
            >
              <div className="font-semibold text-white mb-1">{type.name}</div>
            </button>
          ))}
        </div>

        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrainingTypeModal;
