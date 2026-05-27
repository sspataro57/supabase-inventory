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
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_tool_calls: {
        Row: {
          actor_id: string | null
          called_at: string
          conversation_id: string | null
          id: string
          source: string
          tool_input: Json | null
          tool_name: string
          tool_result: Json | null
        }
        Insert: {
          actor_id?: string | null
          called_at?: string
          conversation_id?: string | null
          id?: string
          source: string
          tool_input?: Json | null
          tool_name: string
          tool_result?: Json | null
        }
        Update: {
          actor_id?: string | null
          called_at?: string
          conversation_id?: string | null
          id?: string
          source?: string
          tool_input?: Json | null
          tool_name?: string
          tool_result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_tool_calls_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_tool_calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      embedding_queue: {
        Row: {
          product_id: string
          queued_at: string
        }
        Insert: {
          product_id: string
          queued_at?: string
        }
        Update: {
          product_id?: string
          queued_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "embedding_queue_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "embedding_queue_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      lots: {
        Row: {
          created_at: string
          created_by: string | null
          expires_on: string | null
          id: string
          is_archived: boolean
          lot_code: string | null
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
          lot_code?: string | null
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
          lot_code?: string | null
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
      mcp_tokens: {
        Row: {
          created_at: string
          id: string
          is_revoked: boolean
          last_used_at: string | null
          name: string
          token_hash: string
          token_prefix: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_revoked?: boolean
          last_used_at?: string | null
          name: string
          token_hash: string
          token_prefix: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_revoked?: boolean
          last_used_at?: string | null
          name?: string
          token_hash?: string
          token_prefix?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      notification_log: {
        Row: {
          entity_id: string
          id: string
          kind: string
          sent_at: string
          sent_date: string
        }
        Insert: {
          entity_id: string
          id?: string
          kind: string
          sent_at?: string
          sent_date?: string
        }
        Update: {
          entity_id?: string
          id?: string
          kind?: string
          sent_at?: string
          sent_date?: string
        }
        Relationships: []
      }
      preferences: {
        Row: {
          anthropic_api_key: string | null
          audit_retention_days: number
          chat_daily_message_limit: number
          custom_llm_api_key: string | null
          custom_llm_url: string | null
          default_llm_model: string | null
          default_llm_provider: string
          default_unit_count: string
          default_unit_mass: string
          default_unit_volume: string
          id: number
          low_stock_check_enabled: boolean
          openai_api_key: string | null
          require_lot_per_movement: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          anthropic_api_key?: string | null
          audit_retention_days?: number
          chat_daily_message_limit?: number
          custom_llm_api_key?: string | null
          custom_llm_url?: string | null
          default_llm_model?: string | null
          default_llm_provider?: string
          default_unit_count?: string
          default_unit_mass?: string
          default_unit_volume?: string
          id?: number
          low_stock_check_enabled?: boolean
          openai_api_key?: string | null
          require_lot_per_movement?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          anthropic_api_key?: string | null
          audit_retention_days?: number
          chat_daily_message_limit?: number
          custom_llm_api_key?: string | null
          custom_llm_url?: string | null
          default_llm_model?: string | null
          default_llm_provider?: string
          default_unit_count?: string
          default_unit_mass?: string
          default_unit_volume?: string
          id?: number
          low_stock_check_enabled?: boolean
          openai_api_key?: string | null
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
          custom_location_text: string | null
          description: string | null
          display_unit: string | null
          embedding: string | null
          embedding_source_hash: string | null
          embedding_updated_at: string | null
          id: string
          inventory_type: string | null
          is_archived: boolean
          location_id: string | null
          manufacturer: string | null
          manufacturer_item_no: string | null
          measure_type: Database["public"]["Enums"]["measure_type"]
          name: string
          pack_size: number | null
          reorder_point: number | null
          reorder_quantity: number | null
          sku: string
          sub_location_id: string | null
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
          custom_location_text?: string | null
          description?: string | null
          display_unit?: string | null
          embedding?: string | null
          embedding_source_hash?: string | null
          embedding_updated_at?: string | null
          id?: string
          inventory_type?: string | null
          is_archived?: boolean
          location_id?: string | null
          manufacturer?: string | null
          manufacturer_item_no?: string | null
          measure_type: Database["public"]["Enums"]["measure_type"]
          name: string
          pack_size?: number | null
          reorder_point?: number | null
          reorder_quantity?: number | null
          sku: string
          sub_location_id?: string | null
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
          custom_location_text?: string | null
          description?: string | null
          display_unit?: string | null
          embedding?: string | null
          embedding_source_hash?: string | null
          embedding_updated_at?: string | null
          id?: string
          inventory_type?: string | null
          is_archived?: boolean
          location_id?: string | null
          manufacturer?: string | null
          manufacturer_item_no?: string | null
          measure_type?: Database["public"]["Enums"]["measure_type"]
          name?: string
          pack_size?: number | null
          reorder_point?: number | null
          reorder_quantity?: number | null
          sku?: string
          sub_location_id?: string | null
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
            foreignKeyName: "products_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_sub_location_id_fkey"
            columns: ["sub_location_id"]
            isOneToOne: false
            referencedRelation: "sub_locations"
            referencedColumns: ["id"]
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
          theme: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          is_active?: boolean
          role?: string
          theme?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          is_active?: boolean
          role?: string
          theme?: string
        }
        Relationships: []
      }
      sub_locations: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          level: number
          location_id: string
          notes: string | null
          shelf: string
          spot: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          level: number
          location_id: string
          notes?: string | null
          shelf: string
          spot: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          level?: number
          location_id?: string
          notes?: string | null
          shelf?: string
          spot?: number
        }
        Relationships: [
          {
            foreignKeyName: "sub_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
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
      is_admin: { Args: never; Returns: boolean }
      report_audit_trail: {
        Args: { p_from: string; p_to: string }
        Returns: Database["public"]["CompositeTypes"]["report_audit_trail_row"][]
        SetofOptions: {
          from: "*"
          to: "report_audit_trail_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      report_dead_stock: {
        Args: { p_days_inactive?: number }
        Returns: Database["public"]["CompositeTypes"]["report_dead_stock_row"][]
        SetofOptions: {
          from: "*"
          to: "report_dead_stock_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      report_expiring_lots: {
        Args: { p_days_ahead?: number }
        Returns: Database["public"]["CompositeTypes"]["report_expiring_lots_row"][]
        SetofOptions: {
          from: "*"
          to: "report_expiring_lots_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      report_inventory_by_location: {
        Args: never
        Returns: Database["public"]["CompositeTypes"]["report_inventory_by_location_row"][]
        SetofOptions: {
          from: "*"
          to: "report_inventory_by_location_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      report_inventory_detailed: {
        Args: never
        Returns: Database["public"]["CompositeTypes"]["report_inventory_detailed_row"][]
        SetofOptions: {
          from: "*"
          to: "report_inventory_detailed_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      report_inventory_per_product: {
        Args: never
        Returns: Database["public"]["CompositeTypes"]["report_inventory_per_product_row"][]
        SetofOptions: {
          from: "*"
          to: "report_inventory_per_product_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      report_low_stock: {
        Args: never
        Returns: Database["public"]["CompositeTypes"]["report_low_stock_row"][]
        SetofOptions: {
          from: "*"
          to: "report_low_stock_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      report_movements_per_product: {
        Args: { p_from: string; p_product_id: string; p_to: string }
        Returns: Database["public"]["CompositeTypes"]["report_movements_per_product_row"][]
        SetofOptions: {
          from: "*"
          to: "report_movements_per_product_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      report_movements_summary: {
        Args: { p_from: string; p_to: string }
        Returns: Database["public"]["CompositeTypes"]["report_movements_summary_row"][]
        SetofOptions: {
          from: "*"
          to: "report_movements_summary_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      report_physical_count_sheet: {
        Args: { p_name_filter?: string }
        Returns: Database["public"]["CompositeTypes"]["report_physical_count_sheet_row"][]
        SetofOptions: {
          from: "*"
          to: "report_physical_count_sheet_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      resolve_display_unit: {
        Args: {
          p_display_unit: string
          p_measure_type: Database["public"]["Enums"]["measure_type"]
        }
        Returns: string
      }
      search_products_hybrid: {
        Args: { query_text: string; query_vec: string; result_limit?: number }
        Returns: {
          display_unit: string
          id: string
          is_archived: boolean
          measure_type: string
          name: string
          rrf_score: number
          sku: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      measure_type: "mass" | "volume" | "count"
      movement_type: "check_in" | "check_out" | "adjustment" | "void"
    }
    CompositeTypes: {
      report_audit_trail_row: {
        occurred_at: string | null
        actor_email: string | null
        action: string | null
        entity_type: string | null
        entity_id: string | null
        diff: Json | null
      }
      report_dead_stock_row: {
        product_id: string | null
        sku: string | null
        name: string | null
        display_unit: string | null
        on_hand_display: number | null
        last_movement_at: string | null
        days_inactive: number | null
      }
      report_expiring_lots_row: {
        lot_id: string | null
        lot_code: string | null
        product_id: string | null
        sku: string | null
        product_name: string | null
        expires_on: string | null
        days_until_expiry: number | null
        is_expired: boolean | null
        on_hand_display: number | null
        display_unit: string | null
      }
      report_inventory_by_location_row: {
        location_code: string | null
        room_name: string | null
        sub_location_code: string | null
        product_count: number | null
        lot_count: number | null
        on_hand_mass_oz: number | null
        on_hand_volume_floz: number | null
        on_hand_count_ea: number | null
      }
      report_inventory_detailed_row: {
        product_id: string | null
        sku: string | null
        product_name: string | null
        lot_id: string | null
        lot_code: string | null
        expires_on: string | null
        is_expired: boolean | null
        on_hand_display: number | null
        display_unit: string | null
        sub_location_code: string | null
        room_name: string | null
      }
      report_inventory_per_product_row: {
        product_id: string | null
        sku: string | null
        name: string | null
        display_unit: string | null
        on_hand_display: number | null
        reorder_point_display: number | null
        reorder_qty_display: number | null
        is_low_stock: boolean | null
        lot_count: number | null
      }
      report_low_stock_row: {
        product_id: string | null
        sku: string | null
        name: string | null
        display_unit: string | null
        on_hand_display: number | null
        reorder_point_display: number | null
        shortage_display: number | null
        suggested_order_display: number | null
      }
      report_movements_per_product_row: {
        movement_id: string | null
        occurred_at: string | null
        movement_type: string | null
        input_quantity: number | null
        input_unit: string | null
        display_quantity: number | null
        display_unit: string | null
        reason: string | null
        lot_code: string | null
        performed_by: string | null
      }
      report_movements_summary_row: {
        day: string | null
        product_id: string | null
        sku: string | null
        product_name: string | null
        display_unit: string | null
        n_check_ins: number | null
        n_check_outs: number | null
        in_display: number | null
        out_display: number | null
        net_display: number | null
      }
      report_physical_count_sheet_row: {
        sku: string | null
        name: string | null
        display_unit: string | null
        system_on_hand: number | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
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

