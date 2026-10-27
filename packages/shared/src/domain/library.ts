import { z } from "zod";

export const LIBRARY_STATUSES = ["pendiente", "viendo", "vista", "abandonada"] as const;

export const LibraryStatusSchema = z.enum(LIBRARY_STATUSES);

export type LibraryStatus = z.infer<typeof LibraryStatusSchema>;
