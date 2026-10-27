import { z } from "zod";

export const PAGE_SIZE_MAX = 50;
export const PAGE_SIZE_DEFAULT = 20;

// Paginación estándar: ?page=1&pageSize=20, con máximo 50 (README).
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

// Forma de todas las respuestas paginadas: { items, page, pageSize, total }.
export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};
