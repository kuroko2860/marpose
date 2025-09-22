import React, { useState } from "react";
import { drawPoseSkeleton, drawBoundingBoxes } from "./drawingUtils";

const ApiDataTester = () => {
  const [testData, setTestData] = useState(null);
  const [canvasRef, setCanvasRef] = useState(null);

  // Mock API data from your mock.json
  const mockApiData = {
    poses: [
      {
        track_id: "1",
        keypoints_2d: [
          [355.1112976074219, 293.0240478515625],
          [390.3719482421875, 246.33349609375],
          [306.91290283203125, 248.26589965820312],
          [428.1817626953125, 257.9663391113281],
          [237.9345703125, 263.35797119140625],
          [494.58258056640625, 460.8778076171875],
          [107.75708770751953, 456.816162109375],
          [536.1680297851562, 470.33441162109375],
          [45.539310455322266, 462.06585693359375],
          [442.00982666015625, 443.1922607421875],
          [186.3954620361328, 431.0640563964844],
          [434.50592041015625, 367.52838134765625],
          [220.09298706054688, 368.9256591796875],
          [363.69879150390625, 455.29278564453125],
          [327.3861389160156, 402.25225830078125],
          [367.15667724609375, 448.30352783203125],
          [243.3895721435547, 463.030029296875],
        ],
        bbox: [
          25.878021240234375, 67.96946716308594, 541.8651123046875,
          476.00244140625,
        ],
      },
    ],
    success: true,
  };

  const testApiData = () => {
    setTestData(mockApiData);

    // Draw on canvas after a short delay to ensure canvas is ready
    setTimeout(() => {
      if (canvasRef) {
        const ctx = canvasRef.getContext("2d");
        const canvas = canvasRef;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Create a simple background
        ctx.fillStyle = "#1f2937";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw bounding boxes
        drawBoundingBoxes(ctx, mockApiData.poses, canvas.width, canvas.height);

        // Draw skeleton
        drawPoseSkeleton(
          ctx,
          mockApiData.poses,
          canvas.width,
          canvas.height,
          true,
          {}
        );

        console.log("Drew API data on canvas:", mockApiData);
      }
    }, 100);
  };

  const clearCanvas = () => {
    if (canvasRef) {
      const ctx = canvasRef.getContext("2d");
      const canvas = canvasRef;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    setTestData(null);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 m-4">
      <h3 className="text-lg font-bold text-white mb-4">
        API Data Format Tester
      </h3>

      <div className="mb-4">
        <div className="flex space-x-2">
          <button
            onClick={testApiData}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Test API Data Format
          </button>
          <button
            onClick={clearCanvas}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
          >
            Clear Canvas
          </button>
        </div>
      </div>

      <div className="mb-4">
        <canvas
          ref={setCanvasRef}
          width={640}
          height={480}
          className="border border-gray-600 rounded bg-gray-700"
        />
      </div>

      {testData && (
        <div className="bg-black rounded p-2 h-64 overflow-y-auto">
          <div className="text-green-400 text-sm font-mono">
            <div className="mb-2">API Data Structure:</div>
            <pre>{JSON.stringify(testData, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiDataTester;
