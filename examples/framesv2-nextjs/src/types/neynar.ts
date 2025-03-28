interface Address {
  city: string;
  state: string;
  country: string;
  country_code: string;
}

export interface NeynarUser {
  object: string;
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  custody_address: string;
  profile: {
    bio: {
      text: string;
    };
    location: {
      latitude: number;
      longitude: number;
      address: Address;
    };
  };
  follower_count: number;
  following_count: number;
  verifications: string[];
  verified_addresses: {
    eth_addresses: string[];
    sol_addresses: string[];
  };
  verified_accounts: {
    platform: string;
    username: string;
  }[];
  power_badge: boolean;
  viewer_context: {
    following: boolean;
    followed_by: boolean;
    blocking: boolean;
    blocked_by: boolean;
  };
}

export type FarcasterUserBulkResponse = {
  status: string;
  data: {
    users: NeynarUser[];
  };
};
