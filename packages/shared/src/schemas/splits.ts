import { z } from "zod";

export const SplitNameSchema = z.enum(["train", "dev", "holdout", "gold-holdout"]);
export type SplitName = z.infer<typeof SplitNameSchema>;

export const SplitsManifestSchema = z.object({
  domain: z.string().min(1),
  seed: z.number().int().nonnegative(),
  splits: z.object({
    train: z.array(z.string()).default([]),
    dev: z.array(z.string()).default([]),
    holdout: z.array(z.string()).default([]),
    "gold-holdout": z.array(z.string()).default([]),
  }),
  counts: z.object({
    train: z.number().int().nonnegative(),
    dev: z.number().int().nonnegative(),
    holdout: z.number().int().nonnegative(),
    "gold-holdout": z.number().int().nonnegative(),
  }),
  generated_at: z.string().min(1),
});
export type SplitsManifest = z.infer<typeof SplitsManifestSchema>;
