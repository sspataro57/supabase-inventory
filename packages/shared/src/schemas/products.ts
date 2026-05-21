import { z } from "zod";
import { ShelfSchema, LevelSchema, SpotSchema } from "./locations";

export const BarcodeSchema = z.object({
  code: z.string().min(1, "Barcode value required"),
  code_type: z.enum(["barcode", "qr", "sku"]),
});

export const ProductFormSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  measure_type: z.enum(["mass", "volume", "count"]),
  display_unit: z.string().optional(),
  pack_size: z.coerce.number().int().positive().optional().nullable(),
  reorder_point: z.coerce.number().nonnegative().optional().nullable(),
  reorder_quantity: z.coerce.number().nonnegative().optional().nullable(),
  reorder_unit: z.string().optional(), // unit used to enter reorder values — converted to base in action
  user_can_check_in: z.boolean().default(false),
  user_can_check_out: z.boolean().default(false),
  barcodes: z.array(BarcodeSchema).default([]),
});

export type ProductFormValues = z.infer<typeof ProductFormSchema>;

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v === "" ? undefined : v))
  .refine((v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: "Date must be YYYY-MM-DD",
  });

export const NewIngredientFormSchema = z.object({
  // Product master
  sku: z.string().trim().min(1, "RM# is required"),
  name: z.string().trim().min(1, "Name is required"),
  inventory_type: optionalText,
  manufacturer: optionalText,
  manufacturer_item_no: optionalText,
  broker: optionalText,
  broker_item_no: optionalText,
  allergen: optionalText,
  category: optionalText,
  // Sub-location (per product, not per lot)
  room_id: z.string().uuid("Room is required"),
  shelf: ShelfSchema,
  level: LevelSchema,
  spot: SpotSchema,
  // Lot
  lot_code: z.string().trim().min(1, "Lot Code is required"),
  date_received: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date received must be YYYY-MM-DD"),
  manufacture_date: optionalDate,
  expiration_date: optionalDate,
  // Movement (always recorded in oz)
  amount_received_oz: z.coerce.number().positive("Amount received must be > 0"),
});

export type NewIngredientFormValues = z.infer<typeof NewIngredientFormSchema>;
