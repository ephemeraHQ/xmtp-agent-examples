import { IdentifierKind } from "@xmtp/agent-sdk";
import { createNameResolver } from "@xmtp/agent-sdk/user";
import type { GroupMember } from "@xmtp/agent-sdk";
import { loadEnvFile } from "./general";

loadEnvFile();
// Create resolver instance (uses web3.bio under the hood)
const resolveAddress = createNameResolver(process.env.WEB3_BIO_API_KEY || "");

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
 * Resolves an identifier to an Ethereum address
 * Handles full addresses, shortened addresses (in groups), and domain names
 * @param identifier - Ethereum address or domain name to resolve
 * @param memberAddresses - Optional array of member addresses to match shortened addresses against
 * @returns Ethereum address or null if not found
 */
export const resolveIdentifier = async (
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

  // If it's just a username (no dots), append .farcaster.eth
  if (!identifier.includes(".")) {
    identifier = `${identifier}.farcaster.eth`;
  }
  console.log(identifier);
  // Otherwise, resolve using agent-sdk
  return resolveAddress(identifier);
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
  // Updated to match multi-level domains like byteai.base.eth
  const domains = message.match(/\b(?<!@)([\w-]+(?:\.[\w-]+)*\.eth)\b/g);
  if (domains) {
    mentions.push(...domains);
  }

  // Remove duplicates
  const uniqueMentions = [...new Set(mentions)];

  // Filter out parent domains when subdomains are present
  // e.g., if "byteai.base.eth" exists, remove "base.eth"
  return uniqueMentions.filter((mention) => {
    // Check if this mention is a parent domain of any other mention
    const isParentOfAnother = uniqueMentions.some(
      (other) => other !== mention && other.endsWith(`.${mention}`),
    );
    return !isParentOfAnother;
  });
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
      results[mention] = await resolveIdentifier(mention, memberAddresses);
    }),
  );

  return results;
};
