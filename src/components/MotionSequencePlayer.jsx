import React, { useState, useEffect, useRef } from "react";

const MotionSequencePlayer = ({
  motionSequence,
  poses,
  onDrawPoseSkeleton,
  onDrawBoundingBoxes,
  defenderTrackId,
}) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(0);

  // Auto-play the sequence when component mounts
  useEffect(() => {
    if (motionSequence && motionSequence.length > 0) {
      setIsPlaying(true);
    }
  }, [motionSequence]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;

    const animate = (currentTime) => {
      if (currentTime - lastTimeRef.current >= 100 / playbackSpeed) {
        setCurrentFrame((prev) => {
          const nextFrame = prev + 1;
          if (nextFrame >= motionSequence.length) {
            setIsPlaying(false);
            return 0; // Reset to first frame
          }
          return nextFrame;
        });
        lastTimeRef.current = currentTime;
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, motionSequence.length]);

  // Draw current frame
  useEffect(() => {
    if (!canvasRef.current || !motionSequence || motionSequence.length === 0)
      return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw current frame
    const currentPose = motionSequence[currentFrame];
    if (currentPose) {
      // If we have a webcam frame, display it
      if (currentPose.webcamFrame) {
        const img = new Image();
        img.onload = () => {
          // Draw the webcam frame
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Draw skeleton overlays on top of the webcam frame
          if (currentPose.keypoints_2d) {
            const posesToDraw = [
              {
                keypoints_2d: currentPose.keypoints_2d,
                track_id: currentPose.track_id,
                bbox: currentPose.bbox || [0, 0, canvas.width, canvas.height],
              },
            ];

            // Draw bounding boxes
            onDrawBoundingBoxes(
              ctx,
              posesToDraw,
              canvas.width,
              canvas.height,
              defenderTrackId
            );

            // Draw skeleton
            onDrawPoseSkeleton(
              ctx,
              posesToDraw,
              canvas.width,
              canvas.height,
              true, // Detail view
              defenderTrackId
            );
          }
        };
        img.src = currentPose.webcamFrame;
      } else if (currentPose.keypoints_2d) {
        // Fallback: draw skeleton on blank canvas if no webcam frame
        const posesToDraw = [
          {
            keypoints_2d: currentPose.keypoints_2d,
            track_id: currentPose.track_id,
            bbox: currentPose.bbox || [0, 0, canvas.width, canvas.height],
          },
        ];

        // Draw bounding boxes
        onDrawBoundingBoxes(
          ctx,
          posesToDraw,
          canvas.width,
          canvas.height,
          defenderTrackId
        );

        // Draw skeleton
        onDrawPoseSkeleton(
          ctx,
          posesToDraw,
          canvas.width,
          canvas.height,
          true, // Detail view
          defenderTrackId
        );
      }
    }
  }, [
    currentFrame,
    motionSequence,
    onDrawPoseSkeleton,
    onDrawBoundingBoxes,
    defenderTrackId,
  ]);

  if (!motionSequence || motionSequence.length === 0) {
    return (
      <div className="bg-gray-700 rounded-lg p-4 text-center">
        <p className="text-gray-400">Không có chuỗi chuyển động</p>
      </div>
    );
  }

  const progress = ((currentFrame + 1) / motionSequence.length) * 100;

  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h5 className="font-semibold text-white flex items-center">
          <span className="text-xl mr-2">🎬</span>
          Chuỗi chuyển động ({motionSequence.length} khung)
        </h5>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
          >
            {isPlaying ? "⏸️ Tạm dừng" : "▶️ Phát"}
          </button>
          <button
            onClick={() => setCurrentFrame(0)}
            className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
          >
            🔄 Lặp lại
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative mb-4">
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="w-full h-auto bg-gray-800 rounded border border-gray-600"
        />

        {/* Frame counter overlay */}
        <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm">
          Khung {currentFrame + 1}/{motionSequence.length}
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-2 left-2 right-2">
          <div className="bg-gray-600 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <label className="text-sm text-gray-300">
            Tốc độ:
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              className="ml-2 bg-gray-600 text-white rounded px-2 py-1 text-sm"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>
          </label>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentFrame(Math.max(0, currentFrame - 1))}
            disabled={currentFrame === 0}
            className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-700 disabled:text-gray-500 text-white px-3 py-1 rounded text-sm"
          >
            ⏮️ Trước
          </button>
          <button
            onClick={() =>
              setCurrentFrame(
                Math.min(motionSequence.length - 1, currentFrame + 1)
              )
            }
            disabled={currentFrame === motionSequence.length - 1}
            className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-700 disabled:text-gray-500 text-white px-3 py-1 rounded text-sm"
          >
            Tiếp ⏭️
          </button>
        </div>
      </div>

      {/* Frame timeline */}
      <div className="mt-4">
        <div className="flex space-x-1 overflow-x-auto">
          {motionSequence.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentFrame(index)}
              className={`w-3 h-3 rounded-full transition-colors ${
                index === currentFrame
                  ? "bg-blue-500"
                  : index < currentFrame
                  ? "bg-blue-300"
                  : "bg-gray-500"
              }`}
              title={`Khung ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default MotionSequencePlayer;
