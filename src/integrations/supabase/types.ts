export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          created_at: string
          date: string
          farm_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          work_done: string | null
          worker_id: string
        }
        Insert: {
          created_at?: string
          date: string
          farm_id: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          work_done?: string | null
          worker_id: string
        }
        Update: {
          created_at?: string
          date?: string
          farm_id?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          work_done?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      bed_plans: {
        Row: {
          config: Json
          created_at: string
          id: string
          name: string
          plot_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          name: string
          plot_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          name?: string
          plot_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bed_plans_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "plots"
            referencedColumns: ["id"]
          },
        ]
      }
      crops: {
        Row: {
          created_at: string
          crop_category: string | null
          crop_name: string
          cultivation_season: string | null
          description: string | null
          growing_days: number | null
          harvesting_window: string | null
          id: string
          is_active: boolean
          optimal_temp: string | null
          sowing_window: string | null
          typical_yield_per_acre: number | null
          updated_at: string
          variety_name: string | null
          water_requirement: string | null
          yield_unit: string | null
        }
        Insert: {
          created_at?: string
          crop_category?: string | null
          crop_name: string
          cultivation_season?: string | null
          description?: string | null
          growing_days?: number | null
          harvesting_window?: string | null
          id?: string
          is_active?: boolean
          optimal_temp?: string | null
          sowing_window?: string | null
          typical_yield_per_acre?: number | null
          updated_at?: string
          variety_name?: string | null
          water_requirement?: string | null
          yield_unit?: string | null
        }
        Update: {
          created_at?: string
          crop_category?: string | null
          crop_name?: string
          cultivation_season?: string | null
          description?: string | null
          growing_days?: number | null
          harvesting_window?: string | null
          id?: string
          is_active?: boolean
          optimal_temp?: string | null
          sowing_window?: string | null
          typical_yield_per_acre?: number | null
          updated_at?: string
          variety_name?: string | null
          water_requirement?: string | null
          yield_unit?: string | null
        }
        Relationships: []
      }
      farm_visitors: {
        Row: {
          count: number
          created_at: string
          date: string
          description: string | null
          end_time: string | null
          farm_id: string
          id: string
          start_time: string | null
          updated_at: string
          visitor_name: string
          visitor_type: Database["public"]["Enums"]["visitor_type"]
        }
        Insert: {
          count?: number
          created_at?: string
          date: string
          description?: string | null
          end_time?: string | null
          farm_id: string
          id?: string
          start_time?: string | null
          updated_at?: string
          visitor_name: string
          visitor_type?: Database["public"]["Enums"]["visitor_type"]
        }
        Update: {
          count?: number
          created_at?: string
          date?: string
          description?: string | null
          end_time?: string | null
          farm_id?: string
          id?: string
          start_time?: string | null
          updated_at?: string
          visitor_name?: string
          visitor_type?: Database["public"]["Enums"]["visitor_type"]
        }
        Relationships: [
          {
            foreignKeyName: "farm_visitors_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farms: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          district: string | null
          established_year: number | null
          farming_type: string | null
          geopolygon: string | null
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          owner_name: string | null
          state: string | null
          total_acreage: number | null
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          district?: string | null
          established_year?: number | null
          farming_type?: string | null
          geopolygon?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          owner_name?: string | null
          state?: string | null
          total_acreage?: number | null
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          district?: string | null
          established_year?: number | null
          farming_type?: string | null
          geopolygon?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          owner_name?: string | null
          state?: string | null
          total_acreage?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      harvest_records: {
        Row: {
          created_at: string
          estimated_remaining_yield: number | null
          harvest_date: string
          harvest_sequence_number: number | null
          harvest_time_end: string | null
          harvest_time_start: string | null
          id: string
          notes: string | null
          plot_id: string
          quality_grade: string | null
          quantity_harvested: number
          sowing_id: string | null
          updated_at: string
          variety_id: string
        }
        Insert: {
          created_at?: string
          estimated_remaining_yield?: number | null
          harvest_date: string
          harvest_sequence_number?: number | null
          harvest_time_end?: string | null
          harvest_time_start?: string | null
          id?: string
          notes?: string | null
          plot_id: string
          quality_grade?: string | null
          quantity_harvested: number
          sowing_id?: string | null
          updated_at?: string
          variety_id: string
        }
        Update: {
          created_at?: string
          estimated_remaining_yield?: number | null
          harvest_date?: string
          harvest_sequence_number?: number | null
          harvest_time_end?: string | null
          harvest_time_start?: string | null
          id?: string
          notes?: string | null
          plot_id?: string
          quality_grade?: string | null
          quantity_harvested?: number
          sowing_id?: string | null
          updated_at?: string
          variety_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "harvest_records_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "plots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvest_records_sowing_id_fkey"
            columns: ["sowing_id"]
            isOneToOne: false
            referencedRelation: "sowing_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvest_records_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "crops"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_sections: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          images: Json
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          images?: Json
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          images?: Json
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      plots: {
        Row: {
          acreage: number | null
          aspect: string | null
          created_at: string
          elevation: number | null
          farm_id: string
          geopolygon: string | null
          id: string
          irrigation_type: string | null
          is_active: boolean
          notes: string | null
          plot_number: string
          slope_percent: number | null
          soil_type: string | null
          updated_at: string
        }
        Insert: {
          acreage?: number | null
          aspect?: string | null
          created_at?: string
          elevation?: number | null
          farm_id: string
          geopolygon?: string | null
          id?: string
          irrigation_type?: string | null
          is_active?: boolean
          notes?: string | null
          plot_number: string
          slope_percent?: number | null
          soil_type?: string | null
          updated_at?: string
        }
        Update: {
          acreage?: number | null
          aspect?: string | null
          created_at?: string
          elevation?: number | null
          farm_id?: string
          geopolygon?: string | null
          id?: string
          irrigation_type?: string | null
          is_active?: boolean
          notes?: string | null
          plot_number?: string
          slope_percent?: number | null
          soil_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plots_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      resource_records: {
        Row: {
          created_at: string
          created_by: string | null
          end_time: string | null
          farm_id: string
          id: string
          notes: string | null
          plot_id: string | null
          quantity: number | null
          resource_name: string
          resource_type: Database["public"]["Enums"]["resource_type"]
          start_time: string | null
          unit: string | null
          updated_at: string
          used_for: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          farm_id: string
          id?: string
          notes?: string | null
          plot_id?: string | null
          quantity?: number | null
          resource_name: string
          resource_type: Database["public"]["Enums"]["resource_type"]
          start_time?: string | null
          unit?: string | null
          updated_at?: string
          used_for?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          farm_id?: string
          id?: string
          notes?: string | null
          plot_id?: string | null
          quantity?: number | null
          resource_name?: string
          resource_type?: Database["public"]["Enums"]["resource_type"]
          start_time?: string | null
          unit?: string | null
          updated_at?: string
          used_for?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_records_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "plots"
            referencedColumns: ["id"]
          },
        ]
      }
      sevak_work_notes: {
        Row: {
          created_at: string
          farm_id: string
          id: string
          notes: string | null
          period_start: string
          period_type: Database["public"]["Enums"]["work_note_period"]
          updated_at: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          farm_id: string
          id?: string
          notes?: string | null
          period_start: string
          period_type: Database["public"]["Enums"]["work_note_period"]
          updated_at?: string
          worker_id: string
        }
        Update: {
          created_at?: string
          farm_id?: string
          id?: string
          notes?: string | null
          period_start?: string
          period_type?: Database["public"]["Enums"]["work_note_period"]
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sevak_work_notes_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sevak_work_notes_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      sowing_records: {
        Row: {
          area_utilized_percent: number | null
          created_at: string
          estimated_harvest_interval_days: number | null
          expected_final_harvest: string | null
          expected_first_harvest: string | null
          id: string
          is_continuous_harvest: boolean
          is_replanting: boolean
          notes: string | null
          original_sowing_id: string | null
          planting_date: string
          plot_id: string
          quantity_planted: number | null
          quantity_unit: string | null
          seed_source: string | null
          status: Database["public"]["Enums"]["sowing_status"]
          updated_at: string
          variety_id: string
        }
        Insert: {
          area_utilized_percent?: number | null
          created_at?: string
          estimated_harvest_interval_days?: number | null
          expected_final_harvest?: string | null
          expected_first_harvest?: string | null
          id?: string
          is_continuous_harvest?: boolean
          is_replanting?: boolean
          notes?: string | null
          original_sowing_id?: string | null
          planting_date: string
          plot_id: string
          quantity_planted?: number | null
          quantity_unit?: string | null
          seed_source?: string | null
          status?: Database["public"]["Enums"]["sowing_status"]
          updated_at?: string
          variety_id: string
        }
        Update: {
          area_utilized_percent?: number | null
          created_at?: string
          estimated_harvest_interval_days?: number | null
          expected_final_harvest?: string | null
          expected_first_harvest?: string | null
          id?: string
          is_continuous_harvest?: boolean
          is_replanting?: boolean
          notes?: string | null
          original_sowing_id?: string | null
          planting_date?: string
          plot_id?: string
          quantity_planted?: number | null
          quantity_unit?: string | null
          seed_source?: string | null
          status?: Database["public"]["Enums"]["sowing_status"]
          updated_at?: string
          variety_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sowing_records_original_sowing_id_fkey"
            columns: ["original_sowing_id"]
            isOneToOne: false
            referencedRelation: "sowing_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sowing_records_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "plots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sowing_records_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "crops"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      worker_types: {
        Row: {
          created_at: string
          label: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          label: string
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          label?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      workers: {
        Row: {
          created_at: string
          email: string | null
          end_date: string | null
          full_name: string
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
          role: string | null
          start_date: string | null
          updated_at: string
          work_summary: string | null
          worker_code: string | null
          worker_type: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          end_date?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          role?: string | null
          start_date?: string | null
          updated_at?: string
          work_summary?: string | null
          worker_code?: string | null
          worker_type: string
        }
        Update: {
          created_at?: string
          email?: string | null
          end_date?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          role?: string | null
          start_date?: string | null
          updated_at?: string
          work_summary?: string | null
          worker_code?: string | null
          worker_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workers_worker_type_fkey"
            columns: ["worker_type"]
            isOneToOne: false
            referencedRelation: "worker_types"
            referencedColumns: ["value"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer"
      attendance_status: "present" | "absent" | "half_day" | "leave" | "holiday"
      resource_type:
        | "equipment"
        | "labor"
        | "material"
        | "water"
        | "biological"
        | "energy"
        | "other"
      sowing_status: "planned" | "active" | "completed" | "failed" | "abandoned"
      visitor_type:
        | "farmer"
        | "government"
        | "previous_sevak"
        | "students"
        | "other"
      work_note_period: "weekly" | "monthly"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "editor", "viewer"],
      attendance_status: ["present", "absent", "half_day", "leave", "holiday"],
      resource_type: [
        "equipment",
        "labor",
        "material",
        "water",
        "biological",
        "energy",
        "other",
      ],
      sowing_status: ["planned", "active", "completed", "failed", "abandoned"],
      visitor_type: [
        "farmer",
        "government",
        "previous_sevak",
        "students",
        "other",
      ],
      work_note_period: ["weekly", "monthly"],
    },
  },
} as const
