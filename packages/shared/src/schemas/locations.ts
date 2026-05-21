import { z } from "zod";

export const RoomCodeSchema = z.string().regex(/^[A-Z0-9]{1,4}$/);

export const ShelfSchema = z
  .string()
  .regex(/^[A-Za-z]$/, "Shelf must be a single letter A–Z")
  .transform((s) => s.toUpperCase());

export const LevelSchema = z.coerce.number().int().min(1).max(99);
export const SpotSchema  = z.coerce.number().int().min(1).max(99);

export const SubLocationCodeSchema = z
  .string()
  .regex(
    /^[A-Z0-9]{1,4}-[A-Z]-\d{2}-\d{2}$/,
    "Sub-location code must look like DR-A-04-02",
  );

export const LocationSchema = z.object({
  id: z.string().uuid(),
  code: RoomCodeSchema,
  name: z.string().min(1),
  is_active: z.boolean(),
});

export const SubLocationSchema = z.object({
  id: z.string().uuid(),
  location_id: z.string().uuid(),
  shelf: z.string().regex(/^[A-Z]$/),
  level: z.number().int().min(1).max(99),
  spot: z.number().int().min(1).max(99),
  code: SubLocationCodeSchema,
  is_active: z.boolean(),
});

export type LocationDto = z.infer<typeof LocationSchema>;
export type SubLocationDto = z.infer<typeof SubLocationSchema>;
