import { z } from "zod";

export const SealReceiptFileSchema = z.object({
  path: z.string().min(1),
  ciphertext_path: z.string().min(1),
  plaintext_sha256: z.string().min(1),
  ciphertext_sha256: z.string().min(1),
  sealed_at: z.string().min(1),
});
export type SealReceiptFile = z.infer<typeof SealReceiptFileSchema>;

export const SealReceiptSchema = z.object({
  domain: z.string().min(1),
  identity_public_key: z.string().min(1),
  sealed_files: z.array(SealReceiptFileSchema),
});
export type SealReceipt = z.infer<typeof SealReceiptSchema>;
