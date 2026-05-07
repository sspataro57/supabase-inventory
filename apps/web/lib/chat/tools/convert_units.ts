import type { ToolDef } from "@/lib/llm/provider";

export const convertUnitsTool: ToolDef = {
  name: "convert_units",
  description: "Convert a quantity from one unit to another.",
  parameters: {
    type: "object",
    properties: {
      value: { type: "number", description: "The quantity to convert" },
      from_unit: { type: "string", description: "The source unit code (e.g. 'kg', 'lb', 'ml')" },
      to_unit: { type: "string", description: "The target unit code" },
    },
    required: ["value", "from_unit", "to_unit"],
  },
  async handler(input, { supabase }) {
    const { value, from_unit, to_unit } = input as { value: number; from_unit: string; to_unit: string };

    const { data: units, error } = await supabase
      .from("units")
      .select("code, to_base_factor, measure_type")
      .in("code", [from_unit, to_unit])
      .eq("is_active", true);

    if (error) return { error: error.message };

    const fromUnit = units?.find((u) => u.code === from_unit);
    const toUnit = units?.find((u) => u.code === to_unit);

    if (!fromUnit) return { error: `Unknown unit: ${from_unit}` };
    if (!toUnit) return { error: `Unknown unit: ${to_unit}` };
    if (fromUnit.measure_type !== toUnit.measure_type) {
      return { error: `Cannot convert between ${fromUnit.measure_type} and ${toUnit.measure_type}` };
    }

    const baseValue = value * Number(fromUnit.to_base_factor);
    const result = baseValue / Number(toUnit.to_base_factor);

    return {
      input: { value, unit: from_unit },
      output: { value: parseFloat(result.toFixed(6)), unit: to_unit },
      measure_type: fromUnit.measure_type,
    };
  },
};
