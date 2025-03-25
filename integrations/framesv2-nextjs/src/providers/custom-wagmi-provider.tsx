"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";

const queryClient = new QueryClient();

interface CustomWagmiProviderProps {
  children: React.ReactNode;
  cookies: string | null;
}
export const CustomWagmiProvider = ({
  children,
  cookies,
}: CustomWagmiProviderProps) => {
  const initialState = cookieToInitialState(wagmiConfig as Config, cookies);

  return (
    <WagmiProvider config={wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
};
