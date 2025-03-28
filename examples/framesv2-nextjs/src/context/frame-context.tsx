"use client";

import { FrameContext } from "@farcaster/frame-core/dist/context";
import sdk from "@farcaster/frame-sdk";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

interface FrameContextValue {
  context: FrameContext | null;
  isSDKLoaded: boolean;
  error: string | null;
  actions: typeof sdk.actions | null;
}

const FrameProviderContext = createContext<FrameContextValue | undefined>(
  undefined,
);

export function useFrame() {
  const context = useContext(FrameProviderContext);
  if (context === undefined) {
    throw new Error("useFrame must be used within a FrameProvider");
  }
  return context;
}

interface FrameProviderProps {
  children: ReactNode;
}

export function FrameProvider({ children }: FrameProviderProps) {
  const [context, setContext] = useState<FrameContext | null>(null);
  const [actions, setActions] = useState<typeof sdk.actions | null>(null);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const context = await sdk.context;
        if (context) {
          setContext(context as FrameContext);
          setActions(sdk.actions);
        } else {
          setError("Failed to load Farcaster context");
        }
        await sdk.actions.ready({
          disableNativeGestures: true,
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to initialize Farcaster Frames SDK",
        );
        console.error("Farcaster Frames SDK initialization error:", err);
      }
    };

    if (sdk && !isSDKLoaded) {
      load().then(() => {
        setIsSDKLoaded(true);
        console.log("Farcaster Frames SDK loaded");
      });
    }
  }, [isSDKLoaded]);

  const value = {
    context,
    actions,
    isSDKLoaded,
    error,
  };

  return (
    <FrameProviderContext.Provider value={value}>
      {children}
    </FrameProviderContext.Provider>
  );
}
