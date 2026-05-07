import { z } from "zod";

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
