import { AgentError } from "@xmtp/agent-sdk";

// Web3.bio API response type
export interface Web3BioProfile {
  address: string | null;
  identity: string;
  platform: string;
  displayName: string;
  avatar: string;
  description: string | null;
}

/**
 * Fetches profiles from Web3.bio API for a given identifier
 * @param identifier - Ethereum address or domain name to resolve
 * @param apiKey - Optional API key for authenticated requests
 * @returns Array of Web3BioProfile results
 */
export const fetchFromWeb3Bio = async (
  identifier: string,
  apiKey?: string,
): Promise<Web3BioProfile[]> => {
  const endpoint = `https://api.web3.bio/ns/${identifier}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers["X-API-KEY"] = `Bearer ${apiKey}`;
  }

  const response = await fetch(endpoint, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new AgentError(
      2000,
      `Could not resolve identifier "${identifier}": ${response.statusText} (${response.status})`,
    );
  }

  return response.json() as Promise<Web3BioProfile[]>;
};

/**
 * Filters and extracts Farcaster names from Web3.bio profiles
 * @param profiles - Array of Web3BioProfile results
 * @returns Array of Farcaster identity names sorted alphabetically
 */
export const getFarcasterNames = (profiles: Web3BioProfile[]): string[] => {
  const farcasterResults = profiles
    .filter((profile) => profile.platform === "farcaster")
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return farcasterResults.map((result) => result.identity);
};

/**
 * Resolves an identifier to Farcaster names
 * @param identifier - Ethereum address or domain name to resolve
 * @param apiKey - Optional API key for authenticated requests
 * @returns Array of Farcaster names
 */
export const resolveFarcasterNames = async (
  identifier: string,
  apiKey?: string,
): Promise<string[]> => {
  const profiles = await fetchFromWeb3Bio(identifier, apiKey);
  return getFarcasterNames(profiles);
};
