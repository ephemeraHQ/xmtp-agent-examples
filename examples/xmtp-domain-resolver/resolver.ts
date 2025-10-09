import { AgentError, IdentifierKind } from "@xmtp/agent-sdk";
import { createNameResolver } from "@xmtp/agent-sdk/user";
import type { GroupMember } from "@xmtp/agent-sdk";

// Create resolver instance (uses web3.bio under the hood)
const resolver = createNameResolver(process.env.WEB3_BIO_API_KEY || "");

// Web3.bio API response type
export interface Web3BioProfile {
  address: string | null;
  identity: string;
  platform: string;
  displayName: string;
  avatar: string;
  description: string | null;
}

// Farcaster API response types
export interface FarcasterTransfer {
  id: number;
  timestamp: number;
  username: string;
  owner: string;
  from: number;
  to: number;
  user_signature: string;
  server_signature: string;
}

export interface FarcasterTransfersResponse {
  transfers: FarcasterTransfer[];
}

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
 * Fetches profiles from Web3.bio API for a given identifier
 * @param identifier - Ethereum address or domain name to resolve
 * @param apiKey - Optional API key for authenticated requests
 * @returns Array of Web3BioProfile results
 */
export const fetchFromWeb3Bio = async (
  identifier: string,
): Promise<Web3BioProfile[]> => {
  const endpoint = `https://api.web3.bio/ns/${identifier}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (process.env.WEB3_BIO_API_KEY) {
    headers["X-API-KEY"] = `Bearer ${process.env.WEB3_BIO_API_KEY}`;
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
 * Resolves an identifier to Farcaster names
 * @param identifier - Ethereum address or domain name to resolve
 * @returns Array of Farcaster names
 */
export const resolveFarcasterNames = async (
  identifier: string,
): Promise<string[]> => {
  try {
    // Use the full API to get profile data (not just address)
    const profiles = await fetchFromWeb3Bio(identifier);
    console.log("profiles", identifier, profiles);
    return getFarcasterNames(profiles || []);
  } catch (error) {
    console.error(`Failed to get Farcaster names for ${identifier}:`, error);
    return [];
  }
};

/**
 * Matches a shortened address against a list of full addresses
 * @param shortenedAddress - Shortened address like "0xabc5…f002"
 * @param fullAddresses - Array of full Ethereum addresses to match against
 * @returns Matched full address or null if no match found
 */
export const matchShortenedAddress = (
  shortenedAddress: string,
  fullAddresses: string[],
): string | null => {
  // Extract prefix and suffix from shortened address
  const match = shortenedAddress.match(
    /^(0x[a-fA-F0-9]+)(?:…|\.{2,3})([a-fA-F0-9]+)$/,
  );
  if (!match) return null;

  const [, prefix, suffix] = match;

  // Find a matching full address
  for (const fullAddress of fullAddresses) {
    const normalizedAddress = fullAddress.toLowerCase();
    if (
      normalizedAddress.startsWith(prefix.toLowerCase()) &&
      normalizedAddress.endsWith(suffix.toLowerCase())
    ) {
      return fullAddress;
    }
  }

  return null;
};

/**
 * Extracts Ethereum addresses from group members
 * @param members - Array of group members
 * @returns Array of Ethereum addresses
 */
export const extractMemberAddresses = (members: GroupMember[]): string[] => {
  const addresses: string[] = [];

  for (const member of members) {
    const ethIdentifier = member.accountIdentifiers.find(
      (id) => id.identifierKind === IdentifierKind.Ethereum,
    );

    if (ethIdentifier) {
      addresses.push(ethIdentifier.identifier);
    }
  }

  return addresses;
};

/**
 * Resolves an identifier to an Ethereum address using agent-sdk's built-in resolver
 * @param identifier - Ethereum address or domain name to resolve
 * @param memberAddresses - Optional array of member addresses to match shortened addresses against
 * @returns Ethereum address or null if not found
 */
export const resolveToAddress = async (
  identifier: string,
  memberAddresses?: string[],
): Promise<string | null> => {
  // If it's already a full ethereum address, return it
  if (identifier.match(/^0x[a-fA-F0-9]{40}$/)) {
    return identifier;
  }

  // If it's a shortened address, try to match against member addresses
  if (identifier.match(/0x[a-fA-F0-9]+(?:…|\.{2,3})[a-fA-F0-9]+/)) {
    if (memberAddresses && memberAddresses.length > 0) {
      return matchShortenedAddress(identifier, memberAddresses);
    }
    return null;
  }

  try {
    // Use agent-sdk's built-in resolver
    const address = await resolver(identifier);
    return address || null;
  } catch (error) {
    console.error(`Failed to resolve ${identifier}:`, error);
    return null;
  }
};

/**
 * Extracts mentions/domains from a message
 * Supports formats: @domain.eth, @username, domain.eth, @0xabc...def, @0xabcdef123456
 * @param message - The message text to parse
 * @returns Array of extracted identifiers
 */
export const extractMentions = (message: string): string[] => {
  const mentions: string[] = [];

  // Match full Ethereum addresses @0x followed by 40 hex chars (check this FIRST)
  const fullAddresses = message.match(/(0x[a-fA-F0-9]{40})\b/g);
  if (fullAddresses) {
    mentions.push(...fullAddresses); // Remove @
  }

  // Match @0xabc...def (shortened address with ellipsis or dots)
  const shortenedAddresses = message.match(
    /@(0x[a-fA-F0-9]+(?:…|\.{2,3})[a-fA-F0-9]+)/g,
  );
  if (shortenedAddresses) {
    mentions.push(...shortenedAddresses.map((m) => m.slice(1))); // Remove @
  }

  // Match @username.eth or @username (but not if it starts with 0x)
  const atMentions = message.match(/@(?!0x)([\w.-]+\.eth|[\w.-]+)/g);
  if (atMentions) {
    mentions.push(...atMentions.map((m) => m.slice(1))); // Remove @
  }

  // Match standalone domain.eth (not preceded by @ and with word boundaries)
  const domains = message.match(/\b(?<!@)([\w-]+\.eth)\b/g);
  if (domains) {
    mentions.push(...domains);
  }

  // Remove duplicates
  return [...new Set(mentions)];
};

/**
 * Resolves all mentions in a message to Ethereum addresses
 * @param message - The message text to parse
 * @param memberAddresses - Optional array of member addresses to match shortened addresses against
 * @returns Object mapping identifiers to addresses
 */
export const resolveMentionsInMessage = async (
  message: string,
  memberAddresses?: string[],
): Promise<Record<string, string | null>> => {
  const mentions = extractMentions(message);
  const results: Record<string, string | null> = {};

  await Promise.all(
    mentions.map(async (mention) => {
      results[mention] = await resolveToAddress(mention, memberAddresses);
    }),
  );

  return results;
};

/**
 * Gets the Farcaster FID (Farcaster ID) for a given username
 * @param username - The Farcaster username (without @ symbol)
 * @returns The FID number or null if not found
 */
export const getFarcasterFID = async (
  username: string,
): Promise<number | null> => {
  try {
    const endpoint = `https://fnames.farcaster.xyz/transfers/current?name=${username}`;
    const response = await fetch(endpoint);

    if (!response.ok) {
      console.error(
        `Failed to fetch FID for ${username}: ${response.statusText}`,
      );
      return null;
    }

    const data = (await response.json()) as FarcasterTransfersResponse;

    if (data.transfers && data.transfers.length > 0) {
      // The "to" field contains the FID
      return data.transfers[0].to;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching FID for ${username}:`, error);
    return null;
  }
};

/**
 * Gets the Farcaster FID for a given Ethereum address or identifier
 * First resolves the identifier to Farcaster usernames, then gets the FID
 * @param identifier - Ethereum address or domain name
 * @returns Object containing username and FID, or null if not found
 */
export const getFarcasterFIDByAddress = async (
  identifier: string,
): Promise<{ username: string; fid: number } | null> => {
  try {
    const farcasterNames = await resolveFarcasterNames(identifier);

    if (farcasterNames.length === 0) {
      console.log(`No Farcaster usernames found for ${identifier}`);
      return null;
    }

    // Get FID for the first username found
    const username = farcasterNames[0];
    const fid = await getFarcasterFID(username);

    if (fid === null) {
      return null;
    }

    return { username, fid };
  } catch (error) {
    console.error(`Error getting FID for ${identifier}:`, error);
    return null;
  }
};
