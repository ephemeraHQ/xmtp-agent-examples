import { z } from "zod";

export const signInSchema = z.object({
  contextData: z.object({
    fid: z.string(),
  }),
  signature: z.string(),
  message: z.string(),
});

export type SignInData = z.infer<typeof signInSchema>;
