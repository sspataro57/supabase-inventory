Connecting to db 5432
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          diff: Json | null
          entity_id: string | null
          entity_type: string
          id: number
          occurred_at: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          diff?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: number
          occurred_at?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          diff?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: number
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lots: {
        Row: {
          created_at: string
          created_by: string | null
          expires_on: string | null
          id: string
          is_archived: boolean
          location: string | null
          lot_code: string
          manufacture_date: string | null
          notes: string | null
          product_id: string
          received_on: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_on?: string | null
          id?: string
          is_archived?: boolean
          location?: string | null
          lot_code: string
          manufacture_date?: string | null
          notes?: string | null
          product_id: string
          received_on?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_on?: string | null
          id?: string
          is_archived?: boolean
          location?: string | null
          lot_code?: string
          manufacture_date?: string | null
          notes?: string | null
          product_id?: string
          received_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "lots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      movements: {
        Row: {
          base_quantity: number
          created_at: string
          id: string
          input_quantity: number
          input_unit: string
          lot_id: string | null
          movement_type: Database["public"]["Enums"]["movement_type"]
          occurred_at: string
          performed_by: string
          product_id: string
          reason: string | null
          voids_movement: string | null
        }
        Insert: {
          base_quantity: number
          created_at?: string
          id?: string
          input_quantity: number
          input_unit: string
          lot_id?: string | null
          movement_type: Database["public"]["Enums"]["movement_type"]
          occurred_at?: string
          performed_by: string
          product_id: string
          reason?: string | null
          voids_movement?: string | null
        }
        Update: {
          base_quantity?: number
          created_at?: string
          id?: string
          input_quantity?: number
          input_unit?: string
          lot_id?: string | null
          movement_type?: Database["public"]["Enums"]["movement_type"]
          occurred_at?: string
          performed_by?: string
          product_id?: string
          reason?: string | null
          voids_movement?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movements_input_unit_fkey"
            columns: ["input_unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "movements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lot_stock"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "movements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_voids_movement_fkey"
            columns: ["voids_movement"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
        ]
      }
      preferences: {
        Row: {
          audit_retention_days: number
          chat_daily_message_limit: number
          default_llm_model: string | null
          default_llm_provider: string
          default_unit_count: string
          default_unit_mass: string
          default_unit_volume: string
          id: number
          low_stock_check_enabled: boolean
          require_lot_per_movement: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          audit_retention_days?: number
          chat_daily_message_limit?: number
          default_llm_model?: string | null
          default_llm_provider?: string
          default_unit_count?: string
          default_unit_mass?: string
          default_unit_volume?: string
          id?: number
          low_stock_check_enabled?: boolean
          require_lot_per_movement?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          audit_retention_days?: number
          chat_daily_message_limit?: number
          default_llm_model?: string | null
          default_llm_provider?: string
          default_unit_count?: string
          default_unit_mass?: string
          default_unit_volume?: string
          id?: number
          low_stock_check_enabled?: boolean
          require_lot_per_movement?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preferences_default_unit_count_fkey"
            columns: ["default_unit_count"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "preferences_default_unit_mass_fkey"
            columns: ["default_unit_mass"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "preferences_default_unit_volume_fkey"
            columns: ["default_unit_volume"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "preferences_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_codes: {
        Row: {
          code: string
          code_type: string
          id: string
          product_id: string
        }
        Insert: {
          code: string
          code_type: string
          id?: string
          product_id: string
        }
        Update: {
          code?: string
          code_type?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_codes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_codes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allergen: string | null
          broker: string | null
          broker_item_no: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          display_unit: string | null
          id: string
          inventory_type: string | null
          is_archived: boolean
          manufacturer: string | null
          manufacturer_item_no: string | null
          measure_type: Database["public"]["Enums"]["measure_type"]
          name: string
          pack_size: number | null
          reorder_point: number | null
          reorder_quantity: number | null
          sku: string
          updated_at: string
          updated_by: string | null
          user_can_check_in: boolean
          user_can_check_out: boolean
        }
        Insert: {
          allergen?: string | null
          broker?: string | null
          broker_item_no?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_unit?: string | null
          id?: string
          inventory_type?: string | null
          is_archived?: boolean
          manufacturer?: string | null
          manufacturer_item_no?: string | null
          measure_type: Database["public"]["Enums"]["measure_type"]
          name: string
          pack_size?: number | null
          reorder_point?: number | null
          reorder_quantity?: number | null
          sku: string
          updated_at?: string
          updated_by?: string | null
          user_can_check_in?: boolean
          user_can_check_out?: boolean
        }
        Update: {
          allergen?: string | null
          broker?: string | null
          broker_item_no?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_unit?: string | null
          id?: string
          inventory_type?: string | null
          is_archived?: boolean
          manufacturer?: string | null
          manufacturer_item_no?: string | null
          measure_type?: Database["public"]["Enums"]["measure_type"]
          name?: string
          pack_size?: number | null
          reorder_point?: number | null
          reorder_quantity?: number | null
          sku?: string
          updated_at?: string
          updated_by?: string | null
          user_can_check_in?: boolean
          user_can_check_out?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_display_unit_fkey"
            columns: ["display_unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "products_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          is_active: boolean
          role: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          is_active?: boolean
          role?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          is_active?: boolean
          role?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          code: string
          display_name: string
          is_active: boolean
          measure_type: Database["public"]["Enums"]["measure_type"]
          system: string
          to_base_factor: number
        }
        Insert: {
          code: string
          display_name: string
          is_active?: boolean
          measure_type: Database["public"]["Enums"]["measure_type"]
          system: string
          to_base_factor: number
        }
        Update: {
          code?: string
          display_name?: string
          is_active?: boolean
          measure_type?: Database["public"]["Enums"]["measure_type"]
          system?: string
          to_base_factor?: number
        }
        Relationships: []
      }
    }
    Views: {
      lot_stock: {
        Row: {
          base_on_hand: number | null
          expires_on: string | null
          lot_code: string | null
          lot_id: string | null
          notes: string | null
          product_id: string | null
          received_on: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stock: {
        Row: {
          base_on_hand: number | null
          display_unit: string | null
          is_low_stock: boolean | null
          measure_type: Database["public"]["Enums"]["measure_type"] | null
          name: string | null
          product_id: string | null
          reorder_point: number | null
          reorder_quantity: number | null
          sku: string | null
          user_can_check_in: boolean | null
          user_can_check_out: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "products_display_unit_fkey"
            columns: ["display_unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      measure_type: "mass" | "volume" | "count"
      movement_type: "check_in" | "check_out" | "adjustment" | "void"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      measure_type: ["mass", "volume", "count"],
      movement_type: ["check_in", "check_out", "adjustment", "void"],
    },
  },
} as const

A new version of Supabase CLI is available: v2.98.2 (currently installed v2.22.6)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
