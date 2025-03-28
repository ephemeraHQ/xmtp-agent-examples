/* eslint-disable @next/next/no-img-element */
import { env } from "@/lib/env";

export const DefaultImage = () => {
  return (
    <img
      src={`${env.NEXT_PUBLIC_URL}/images/frame-default-image.png`}
      alt="Default image for frames"
      width={"600px"}
      height={"400px"}
    />
  );
};
