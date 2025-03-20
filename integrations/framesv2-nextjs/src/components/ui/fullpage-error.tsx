import React from "react";
import { cn } from "@/lib/utils";

interface FullPageErrorProps {
  className?: string;
  errorMessage?: string;
  children?: React.ReactNode;
}

export const FullPageError = ({
  className,
  errorMessage,
  children,
}: FullPageErrorProps) => {
  return (
    <div
      className={cn(
        "flex flex-col min-h-screen items-center justify-center bg-black px-6 text-center gap-2",
        className,
      )}>
      {errorMessage && (
        <>
          <p className="text-white text-2xl">Unexpected Error:</p>
          <p className="text-red-500">{errorMessage}</p>
        </>
      )}
      {children}
    </div>
  );
};
