import ky from "ky";
import { NeynarUser } from "../types";
import { env } from "./env";

/**
 * Fetches a user from Neynar
 * @param fid - The fid of the user
 * @returns The user
 */
export const fetchUserFromNeynar = async (fid: string): Promise<NeynarUser> => {
  const data = await ky
    .get<{ users: NeynarUser[] }>(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
      {
        headers: {
          "x-api-key": env.NEYNAR_API_KEY,
        },
      },
    )
    .json();

  return data.users[0];
};
