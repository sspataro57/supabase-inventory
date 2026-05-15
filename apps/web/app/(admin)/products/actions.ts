"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { toBase } from "@/lib/units/convert";
import { NewIngredientFormSchema, ProductFormSchema } from "@inventory/shared/schemas/products";

async function getAdminClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Forbidden");
  return { supabase, userId: user.id };
}

async function resolveBaseQuantity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  value: number | null | undefined,
  unitCode: string | undefined
): Promise<number | null> {
  if (value == null || !unitCode) return null;
  const { data: unit } = await supabase
    .from("units")
    .select("to_base_factor")
    .eq("code", unitCode)
    .single();
  if (!unit) return null;
  return toBase(value, { code: unitCode, to_base_factor: Number(unit.to_base_factor) });
}

export async function createProduct(formData: FormData) {
  const { supabase, userId } = await getAdminClient();

  const raw = {
    sku: formData.get("sku"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    measure_type: formData.get("measure_type"),
    display_unit: formData.get("display_unit") || undefined,
    pack_size: formData.get("pack_size") || undefined,
    reorder_point: formData.get("reorder_point") || undefined,
    reorder_quantity: formData.get("reorder_quantity") || undefined,
    reorder_unit: formData.get("reorder_unit") || undefined,
    user_can_check_in: formData.get("user_can_check_in") === "true",
    user_can_check_out: formData.get("user_can_check_out") === "true",
    barcodes: JSON.parse((formData.get("barcodes") as string) || "[]"),
  };

  const parsed = ProductFormSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const values = parsed.data;
  const reorderUnit = values.reorder_unit ?? values.display_unit;
  const baseReorderPoint = await resolveBaseQuantity(supabase, values.reorder_point, reorderUnit);
  const baseReorderQty = await resolveBaseQuantity(supabase, values.reorder_quantity, reorderUnit);

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      sku: values.sku,
      name: values.name,
      description: values.description ?? null,
      measure_type: values.measure_type,
      display_unit: values.display_unit ?? null,
      pack_size: values.pack_size ?? null,
      reorder_point: baseReorderPoint,
      reorder_quantity: baseReorderQty,
      user_can_check_in: values.user_can_check_in,
      user_can_check_out: values.user_can_check_out,
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (values.barcodes.length > 0) {
    await supabase.from("product_codes").insert(
      values.barcodes.map((b) => ({
        product_id: product.id,
        code: b.code,
        code_type: b.code_type,
      }))
    );
  }

  await writeAudit(supabase, {
    actorId: userId,
    action: "product.create",
    entityType: "product",
    entityId: product.id,
    after: { sku: values.sku, name: values.name },
  });

  revalidatePath("/catalog");
  redirect(`/catalog/${product.id}`);
}

export async function updateProduct(productId: string, formData: FormData) {
  const { supabase, userId } = await getAdminClient();

  const { data: before } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .single();

  const raw = {
    sku: formData.get("sku"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    measure_type: before?.measure_type, // immutable — take from DB
    display_unit: formData.get("display_unit") || undefined,
    pack_size: formData.get("pack_size") || undefined,
    reorder_point: formData.get("reorder_point") || undefined,
    reorder_quantity: formData.get("reorder_quantity") || undefined,
    reorder_unit: formData.get("reorder_unit") || undefined,
    user_can_check_in: formData.get("user_can_check_in") === "true",
    user_can_check_out: formData.get("user_can_check_out") === "true",
    barcodes: JSON.parse((formData.get("barcodes") as string) || "[]"),
  };

  const parsed = ProductFormSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const values = parsed.data;
  const reorderUnit = values.reorder_unit ?? values.display_unit;
  const baseReorderPoint = await resolveBaseQuantity(supabase, values.reorder_point, reorderUnit);
  const baseReorderQty = await resolveBaseQuantity(supabase, values.reorder_quantity, reorderUnit);

  const { error } = await supabase
    .from("products")
    .update({
      sku: values.sku,
      name: values.name,
      description: values.description ?? null,
      display_unit: values.display_unit ?? null,
      pack_size: values.pack_size ?? null,
      reorder_point: baseReorderPoint,
      reorder_quantity: baseReorderQty,
      user_can_check_in: values.user_can_check_in,
      user_can_check_out: values.user_can_check_out,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);

  if (error) throw new Error(error.message);

  // Replace barcodes
  await supabase.from("product_codes").delete().eq("product_id", productId);
  if (values.barcodes.length > 0) {
    await supabase.from("product_codes").insert(
      values.barcodes.map((b) => ({
        product_id: productId,
        code: b.code,
        code_type: b.code_type,
      }))
    );
  }

  await writeAudit(supabase, {
    actorId: userId,
    action: "product.update",
    entityType: "product",
    entityId: productId,
    before,
    after: { sku: values.sku, name: values.name },
  });

  revalidatePath(`/catalog/${productId}`);
  revalidatePath("/catalog");
  redirect(`/catalog/${productId}`);
}

export async function createIngredient(formData: FormData) {
  const { supabase, userId } = await getAdminClient();

  const raw = {
    sku: formData.get("sku"),
    name: formData.get("name"),
    inventory_type: formData.get("inventory_type") || undefined,
    manufacturer: formData.get("manufacturer") || undefined,
    manufacturer_item_no: formData.get("manufacturer_item_no") || undefined,
    broker: formData.get("broker") || undefined,
    broker_item_no: formData.get("broker_item_no") || undefined,
    allergen: formData.get("allergen") || undefined,
    category: formData.get("category") || undefined,
    lot_code: formData.get("lot_code"),
    location: formData.get("location") || undefined,
    date_received: formData.get("date_received"),
    manufacture_date: formData.get("manufacture_date") || undefined,
    expiration_date: formData.get("expiration_date") || undefined,
    amount_received_oz: formData.get("amount_received_oz") || undefined,
  };

  const parsed = NewIngredientFormSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }
  const v = parsed.data;

  // Oz is mass. Look up its to_base_factor so the movement records base grams.
  const { data: ozUnit } = await supabase
    .from("units")
    .select("to_base_factor")
    .eq("code", "oz")
    .single();
  if (!ozUnit) throw new Error("oz unit not found in units table");
  const baseQuantity = toBase(v.amount_received_oz, {
    code: "oz",
    to_base_factor: Number(ozUnit.to_base_factor),
  });

  // 1. Product master
  const { data: product, error: productErr } = await supabase
    .from("products")
    .insert({
      sku: v.sku,
      name: v.name,
      measure_type: "mass",
      display_unit: "oz",
      inventory_type: v.inventory_type ?? null,
      manufacturer: v.manufacturer ?? null,
      manufacturer_item_no: v.manufacturer_item_no ?? null,
      broker: v.broker ?? null,
      broker_item_no: v.broker_item_no ?? null,
      allergen: v.allergen ?? null,
      category: v.category ?? null,
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single();
  if (productErr) throw new Error(productErr.message);

  // 2. First lot
  const { data: lot, error: lotErr } = await supabase
    .from("lots")
    .insert({
      product_id: product.id,
      lot_code: v.lot_code,
      received_on: v.date_received,
      manufacture_date: v.manufacture_date ?? null,
      expires_on: v.expiration_date ?? null,
      location: v.location ?? null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (lotErr) throw new Error(lotErr.message);

  // 3. Check-in movement for the amount received
  const { error: movementErr } = await supabase.from("movements").insert({
    product_id: product.id,
    lot_id: lot.id,
    movement_type: "check_in",
    base_quantity: baseQuantity,
    input_quantity: v.amount_received_oz,
    input_unit: "oz",
    performed_by: userId,
  });
  if (movementErr) throw new Error(movementErr.message);

  await writeAudit(supabase, {
    actorId: userId,
    action: "product.create",
    entityType: "product",
    entityId: product.id,
    after: { sku: v.sku, name: v.name, lot_code: v.lot_code },
  });

  revalidatePath("/catalog");
  redirect(`/catalog/${product.id}`);
}

export async function archiveProduct(productId: string) {
  const { supabase, userId } = await getAdminClient();

  const { data: before } = await supabase
    .from("products")
    .select("name, sku, is_archived")
    .eq("id", productId)
    .single();

  const { error } = await supabase
    .from("products")
    .update({ is_archived: true, updated_by: userId, updated_at: new Date().toISOString() })
    .eq("id", productId);

  if (error) throw new Error(error.message);

  await writeAudit(supabase, {
    actorId: userId,
    action: "product.archive",
    entityType: "product",
    entityId: productId,
    before,
    after: { is_archived: true },
  });

  revalidatePath("/catalog");
  redirect("/catalog");
}
