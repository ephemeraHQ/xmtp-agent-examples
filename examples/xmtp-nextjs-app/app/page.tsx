"use client";

import { Client, XmtpEnv } from "@xmtp/browser-sdk";
import { useEffect, useState } from "react";
import { createEphemeralSigner, createEphemeralWallet } from "./wallet";

interface Message {
  text: string;
  type: "sent" | "received" | "system" | "error";
  timestamp: Date;
}

interface ServerInfo {
  address: string;
  inboxId: string;
  env: string;
}

interface Wallet {
  privateKey: `0x${string}`;
  address: string;
}

export default function Home() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch server info on component mount
  useEffect(() => {
    const fetchServerInfo = async () => {
      try {
        const response = await fetch("/api/xmtp");
        const data = await response.json();

        if (data.error) {
          console.error("Error fetching server info:", data.error);
          addMessage("Error loading server info: " + data.error, "error");
          return;
        }

        setServerInfo(data);
        console.log("Server info loaded:", data);
      } catch (error) {
        console.error("Error fetching server info:", error);
        addMessage("Error loading server info", "error");
      }
    };

    fetchServerInfo();
  }, []);

  // Create an ephemeral wallet
  const createWallet = () => {
    try {
      // Create a random wallet using viem
      const { privateKey, account } = createEphemeralWallet();

      setWallet({
        privateKey,
        address: account.address,
      });

      console.log("Wallet created:", account.address);

      // Add a message to the history
      addMessage("Wallet created successfully", "system");
    } catch (error) {
      console.error("Error creating wallet:", error);
      addMessage(
        "Error creating wallet: " +
          (error instanceof Error ? error.message : String(error)),
        "error",
      );
    }
  };

  // Send a message to the server
  const sendMessage = async () => {
    if (!wallet || !serverInfo) {
      addMessage("Wallet or server info not available", "error");
      return;
    }

    const messageText = message.trim();
    if (!messageText) {
      addMessage("Please enter a message", "error");
      return;
    }

    try {
      setIsLoading(true);

      // Create XMTP client
      const signer = createEphemeralSigner(wallet.privateKey);
      const client = await Client.create(signer, {
        env: serverInfo.env as XmtpEnv,
      });

      // Send the message to the server
      const response = await fetch("/api/xmtp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: messageText,
          clientAddress: wallet.address,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Add the message to the history
        addMessage(messageText, "sent");

        // Clear the input
        setMessage("");

        // Add a note that we're waiting for a response
        addMessage('Waiting for "gm" response...', "system");
      } else {
        addMessage(
          "Error sending message: " + (result.error || "Unknown error"),
          "error",
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
      addMessage(
        "Error sending message: " +
          (error instanceof Error ? error.message : String(error)),
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Add a message to the history
  const addMessage = (
    text: string,
    type: "sent" | "received" | "system" | "error",
  ) => {
    setMessages((prev) => [...prev, { text, type, timestamp: new Date() }]);
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          XMTP Next.js App
        </h1>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Wallet Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-blue-600">
              Your wallet
            </h2>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Address:{" "}
                <span className="font-mono break-all">
                  {wallet ? wallet.address : "Not created yet"}
                </span>
              </p>
              <button
                onClick={createWallet}
                disabled={!!wallet}
                className={`w-full py-2 px-4 rounded ${
                  wallet
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600 text-white"
                }`}>
                {wallet ? "Wallet created" : "Create ephemeral wallet"}
              </button>
            </div>
          </div>

          {/* Server Info Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-blue-600">
              Server info
            </h2>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Address:{" "}
                <span className="font-mono break-all">
                  {serverInfo?.address || "Loading..."}
                </span>
              </p>
              <p className="text-sm text-gray-600">
                Inbox ID:{" "}
                <span className="font-mono break-all">
                  {serverInfo?.inboxId || "Loading..."}
                </span>
              </p>
              <p className="text-sm text-gray-600">
                Environment: <span>{serverInfo?.env || "Loading..."}</span>
              </p>
            </div>
          </div>

          {/* Message Form Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-blue-600">
              Send message
            </h2>
            <div className="space-y-4">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                disabled={!wallet || isLoading}
                className={`w-full p-3 border rounded-md ${
                  !wallet || isLoading ? "bg-gray-100 cursor-not-allowed" : ""
                }`}
                rows={4}
              />
              <button
                onClick={sendMessage}
                disabled={!wallet || !message.trim() || isLoading}
                className={`w-full py-2 px-4 rounded ${
                  !wallet || !message.trim() || isLoading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600 text-white"
                }`}>
                {isLoading ? "Sending..." : "Send message"}
              </button>
            </div>
          </div>

          {/* Message History Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-blue-600">
              Message history
            </h2>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {messages.length === 0 ? (
                <p className="text-center text-gray-500 italic">
                  No messages yet
                </p>
              ) : (
                messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-md ${
                      msg.type === "sent"
                        ? "bg-blue-50 ml-auto mr-0 max-w-[80%]"
                        : msg.type === "received"
                          ? "bg-gray-100 mr-auto ml-0 max-w-[80%]"
                          : msg.type === "error"
                            ? "bg-red-50 text-red-600"
                            : "bg-blue-50 text-blue-600 italic"
                    }`}>
                    <p>{msg.text}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {msg.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
