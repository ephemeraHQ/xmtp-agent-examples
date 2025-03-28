import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { FullPageError } from "@/components/ui/fullpage-error";
import { FullPageLoader } from "@/components/ui/fullpage-loader";
import { useSignIn } from "@/hooks/use-sign-in";

const UserProviderContext = createContext<
  | {
      userFid: string | null;
    }
  | undefined
>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export const useRegisteredUser = () => {
  const context = useContext(UserProviderContext);
  if (!context) {
    throw new Error("useRegisteredUser must be used within a UserProvider");
  }
  return context;
};

export const UserProvider = ({ children }: UserProviderProps) => {
  const [userFid, setUserFid] = useState<string | null>(null);
  const { signIn, isLoading: isSigningIn, error: signInError } = useSignIn();

  // Try to sign in the user
  useEffect(() => {
    const registerUser = async () => {
      const signInData = await signIn();
      setUserFid(signInData?.userFid ?? null);
    };

    registerUser();
  }, [signIn]);

  // Loading state
  if (isSigningIn) return <FullPageLoader />;

  // Error state
  if (!isSigningIn && signInError) {
    console.error("signInError", signInError);
    return (
      <FullPageError errorMessage={signInError || "Error Signing the user in"}>
        <button onClick={signIn} className="w-[40%] py-2  mt-4">
          Try Again
        </button>
      </FullPageError>
    );
  }

  return (
    <UserProviderContext.Provider
      value={{
        userFid,
      }}>
      {children}
    </UserProviderContext.Provider>
  );
};
