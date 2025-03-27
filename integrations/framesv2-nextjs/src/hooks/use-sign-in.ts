import { sdk } from "@farcaster/frame-sdk";
import ky from "ky";
import { useCallback, useState } from "react";
import { useFrame } from "@/context/frame-context";
import { MESSAGE_EXPIRATION_TIME } from "@/lib/constants";

export const useSignIn = () => {
  const { context } = useFrame();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!context) {
        console.log("No context found");
        return;
      }

      // Check if the user is already signed in
      try {
        const data = await ky
          .get<{ userFid: string | null }>("/api/auth/check")
          .json();
        if (data.userFid) {
          setIsSignedIn(true);
          setIsLoading(false);
          return {
            userFid: data.userFid,
            token: null,
          };
        }
      } catch {
        console.log("User not found in cookies, signing it up...");
      }

      if (context && !context.user?.fid) {
        throw new Error(
          "No FID found. Please make sure you're logged into Warpcast.",
        );
      }
      let referrerFid: number | null = null;
      const result: { message: string; signature: string; address?: string } =
        await sdk.actions.signIn({
          nonce: Math.random().toString(36).substring(2),
          notBefore: new Date().toISOString(),
          expirationTime: new Date(
            Date.now() + MESSAGE_EXPIRATION_TIME,
          ).toISOString(),
        });
      referrerFid =
        context.location?.type === "cast_embed"
          ? context.location.cast.fid
          : null;

      const data = await ky
        .post<{ token: string; userFid: string }>("/api/auth/sign-in", {
          json: {
            signature: result.signature,
            message: result.message,
            contextData: {
              fid: context.user.fid,
            },
            referrerFid,
          },
        })
        .json();

      setIsSignedIn(true);
      return data;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Sign in failed";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [context]);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setIsSignedIn(false);
  }, []);

  return { signIn, logout, isSignedIn, isLoading, error };
};
