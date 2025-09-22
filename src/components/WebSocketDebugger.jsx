import React, { useState, useEffect } from "react";
import PoseApiService from "../services/poseApi";

const WebSocketDebugger = () => {
  const [poseApiService] = useState(() => new PoseApiService());
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [frameCount, setFrameCount] = useState(0);

  useEffect(() => {
    // Connect to WebSocket
    poseApiService.connectWebSocket((data) => {
      console.log("Received pose result:", data);
      setMessages((prev) => [
        ...prev,
        { type: "received", data, timestamp: new Date().toISOString() },
      ]);
    });

    // Check connection status periodically
    const interval = setInterval(() => {
      const status = poseApiService.getConnectionStatus();
      setIsConnected(status.isConnected);
    }, 1000);

    return () => {
      clearInterval(interval);
      poseApiService.disconnectWebSocket();
    };
  }, [poseApiService]);

  const sendTestFrame = async () => {
    try {
      // Create a simple test image (1x1 pixel)
      const canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "red";
      ctx.fillRect(0, 0, 100, 100);

      const imageData = canvas.toDataURL("image/jpeg", 0.8);
      const binaryData = await fetch(imageData).then((res) =>
        res.arrayBuffer()
      );

      const success = await poseApiService.sendFrameForAnalysis(binaryData);
      setFrameCount((prev) => prev + 1);
      setMessages((prev) => [
        ...prev,
        {
          type: "sent",
          success,
          frameCount: frameCount + 1,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.error("Error sending test frame:", error);
      setMessages((prev) => [
        ...prev,
        {
          type: "error",
          error: error.message,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  };

  const clearMessages = () => {
    setMessages([]);
    setFrameCount(0);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 m-4">
      <h3 className="text-lg font-bold text-white mb-4">WebSocket Debugger</h3>

      <div className="mb-4">
        <div className="flex items-center space-x-2 mb-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
          ></div>
          <span className="text-white">
            Status: {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={sendTestFrame}
            disabled={!isConnected}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white px-4 py-2 rounded"
          >
            Send Test Frame ({frameCount})
          </button>
          <button
            onClick={clearMessages}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
          >
            Clear Messages
          </button>
        </div>
      </div>

      <div className="bg-black rounded p-2 h-64 overflow-y-auto">
        <div className="text-green-400 text-sm font-mono">
          {messages.length === 0 ? (
            <div>No messages yet...</div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className="mb-1">
                <span className="text-gray-400">[{msg.timestamp}]</span>
                {msg.type === "sent" && (
                  <span className="text-blue-400">
                    Sent frame #{msg.frameCount} - Success:{" "}
                    {msg.success ? "✅" : "❌"}
                  </span>
                )}
                {msg.type === "received" && (
                  <span className="text-green-400">
                    Received: {JSON.stringify(msg.data)}
                  </span>
                )}
                {msg.type === "error" && (
                  <span className="text-red-400">Error: {msg.error}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default WebSocketDebugger;
