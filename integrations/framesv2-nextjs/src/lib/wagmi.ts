import { farcasterFrame } from "@farcaster/frame-wagmi-connector";
import { base, mainnet } from "viem/chains";
import { createConfig, http } from "wagmi";

const chains = [mainnet, base] as const;

export const wagmiConfig = createConfig({
  chains: chains,
  transports: {
    [mainnet.id]: http("https://mainnet.llamarpc.com"),
    [base.id]: http("https://base.llamarpc.com"),
  },
  connectors: [farcasterFrame()],
});
