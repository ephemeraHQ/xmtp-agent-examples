import * as jose from "jose";
import { NextRequest, NextResponse } from "next/server";
import { Address, verifyMessage } from "viem";
import { env } from "@/lib/env";
import { fetchUserFromNeynar } from "@/lib/neynar";
import { NeynarUser } from "@/types";
import { signInSchema } from "@/types/sign-in";

export const POST = async (req: NextRequest) => {
  const data = await req.json();
  const parsedData = signInSchema.safeParse(data);

  if (!parsedData.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { contextData, signature, message } = parsedData.data;

  // If the context is Farcaster, we need to fetch the user from Neynar
  const neynarUser: NeynarUser | undefined = await fetchUserFromNeynar(
    contextData.fid,
  );
  if (!neynarUser) {
    return NextResponse.json(
      { message: "No Farcaster User found for this FID" },
      { status: 404 },
    );
  }

  // Get the wallet address from the context or the Neynar user
  const walletAddress = neynarUser?.custody_address;

  // Verify signature matches custody address
  const isValidSignature = await verifyMessage({
    address: walletAddress as Address,
    message,
    signature: signature as `0x${string}`,
  });

  if (!isValidSignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Generate JWT token
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const token = await new jose.SignJWT({
    userFid: neynarUser.fid,
    walletAddress,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  // Create the response
  const response = NextResponse.json(
    { token, userFid: neynarUser.fid },
    { status: 200 },
  );

  // Set the auth cookie with the JWT token
  response.cookies.set({
    name: "auth_token",
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: "/",
  });

  return response;
};
