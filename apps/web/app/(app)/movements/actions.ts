"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toBase } from "@/lib/units/convert";

export async function submitMovement(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const productId = formData.get("product_id") as string;
  const movementType = formData.get("movement_type") as "check_in" | "check_out";
  const inputQuantity = parseFloat(formData.get("quantity") as string);
  const unitCode = formData.get("unit") as string;
  const reason = (formData.get("reason") as string) || null;

  // Lot fields
  let lotId = (formData.get("lot_id") as string) || null;
  const newLotCode = (formData.get("new_lot_code") as string) || null;
  const newLotExpires = (formData.get("new_lot_expires") as string) || null;

  if (!productId || !movementType || isNaN(inputQuantity) || inputQuantity <= 0) {
    throw new Error("Invalid input — quantity must be a positive number.");
  }

  const [{ data: product }, { data: profile }, { data: unit }] = await Promise.all([
    supabase.from("products").select("*").eq("id", productId).single(),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("units").select("to_base_factor").eq("code", unitCode).single(),
  ]);

  if (!product) throw new Error("Product not found.");
  if (!unit) throw new Error("Unit not found.");

  const isAdmin = profile?.role === "admin";

  if (!isAdmin) {
    if (movementType === "check_in" && !product.user_can_check_in) {
      throw new Error("Check-in is not enabled for this product.");
    }
    if (movementType === "check_out" && !product.user_can_check_out) {
      throw new Error("Check-out is not enabled for this product.");
    }
  }

  // Create new lot if requested
  if (newLotCode && !lotId) {
    const { data: newLot, error: lotErr } = await supabase
      .from("lots")
      .insert({
        product_id: productId,
        lot_code: newLotCode,
        expires_on: newLotExpires || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (lotErr) throw new Error(`Failed to create lot: ${lotErr.message}`);
    lotId = newLot!.id;
  }

  const factor = Number(unit.to_base_factor);
  const baseUnsigned = toBase(inputQuantity, { code: unitCode, to_base_factor: factor });
  const baseQuantity = movementType === "check_out" ? -baseUnsigned : baseUnsigned;

  // Negative-stock guard
  if (movementType === "check_out") {
    const stockQuery = lotId
      ? supabase.from("lot_stock").select("base_on_hand").eq("lot_id", lotId).single()
      : supabase.from("product_stock").select("base_on_hand").eq("product_id", productId).single();

    const { data: stock } = await stockQuery;
    const onHand = Number(stock?.base_on_hand ?? 0);
    if (onHand + baseQuantity < 0) {
      throw new Error(
        `Insufficient stock. On hand: ${onHand} base units, requested: ${baseUnsigned}.`
      );
    }
  }

  const { error } = await supabase.from("movements").insert({
    product_id: productId,
    lot_id: lotId || null,
    movement_type: movementType,
    base_quantity: baseQuantity,
    input_quantity: inputQuantity,
    input_unit: unitCode,
    reason,
    performed_by: user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/catalog/${productId}`);
  revalidatePath("/catalog");
  revalidatePath("/dashboard");
  redirect(`/catalog/${productId}`);
}
