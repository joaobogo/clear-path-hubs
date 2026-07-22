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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          diff: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          trace_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          trace_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          trace_id?: string | null
        }
        Relationships: []
      }
      client_intakes: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          idempotency_key: string
          org_id: string | null
          payload: Json
          position_id: string | null
          status: string
          submitter_email: string
          trace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key: string
          org_id?: string | null
          payload: Json
          position_id?: string | null
          status?: string
          submitter_email: string
          trace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key?: string
          org_id?: string | null
          payload?: Json
          position_id?: string | null
          status?: string
          submitter_email?: string
          trace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_intakes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_intakes_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      org_memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          domain: string | null
          id: string
          name: string
          name_normalized: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          id?: string
          name: string
          name_normalized: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          id?: string
          name?: string
          name_normalized?: string
        }
        Relationships: []
      }
      position_revisions: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          position_id: string
          reason: string | null
          snapshot: Json
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          position_id: string
          reason?: string | null
          snapshot: Json
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          position_id?: string
          reason?: string | null
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "position_revisions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          activated_at: string | null
          approved_at: string | null
          approved_by: string | null
          compensation: string | null
          created_at: string
          created_by: string | null
          dealbreakers: string | null
          employment_type: string | null
          headcount: number | null
          hiring_urgency: string | null
          id: string
          intake_id: string | null
          job_description: string | null
          location: string | null
          must_have_skills: string[]
          org_id: string
          preferred_requirements: string | null
          seniority: string | null
          status: Database["public"]["Enums"]["position_status"]
          target_countries: string[] | null
          target_titles: string[] | null
          title: string
          updated_at: string
          visibility: string
          work_authorization: string | null
          work_model: Database["public"]["Enums"]["work_model"]
        }
        Insert: {
          activated_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          compensation?: string | null
          created_at?: string
          created_by?: string | null
          dealbreakers?: string | null
          employment_type?: string | null
          headcount?: number | null
          hiring_urgency?: string | null
          id?: string
          intake_id?: string | null
          job_description?: string | null
          location?: string | null
          must_have_skills?: string[]
          org_id: string
          preferred_requirements?: string | null
          seniority?: string | null
          status?: Database["public"]["Enums"]["position_status"]
          target_countries?: string[] | null
          target_titles?: string[] | null
          title: string
          updated_at?: string
          visibility?: string
          work_authorization?: string | null
          work_model: Database["public"]["Enums"]["work_model"]
        }
        Update: {
          activated_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          compensation?: string | null
          created_at?: string
          created_by?: string | null
          dealbreakers?: string | null
          employment_type?: string | null
          headcount?: number | null
          hiring_urgency?: string | null
          id?: string
          intake_id?: string | null
          job_description?: string | null
          location?: string | null
          must_have_skills?: string[]
          org_id?: string
          preferred_requirements?: string | null
          seniority?: string | null
          status?: Database["public"]["Enums"]["position_status"]
          target_countries?: string[] | null
          target_titles?: string[] | null
          title?: string
          updated_at?: string
          visibility?: string
          work_authorization?: string | null
          work_model?: Database["public"]["Enums"]["work_model"]
        }
        Relationships: [
          {
            foreignKeyName: "positions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_questions: {
        Row: {
          created_at: string
          id: string
          kind: string
          ordering: number
          position_id: string
          prompt: string
          required: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          ordering?: number
          position_id: string
          prompt: string
          required?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          ordering?: number
          position_id?: string
          prompt?: string
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "screening_questions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "client" | "candidate"
      position_status:
        | "draft"
        | "submitted"
        | "needs_clarification"
        | "approved"
        | "active"
        | "paused"
        | "closed"
        | "archived"
      work_model: "remote" | "hybrid" | "onsite"
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
  public: {
    Enums: {
      app_role: ["admin", "client", "candidate"],
      position_status: [
        "draft",
        "submitted",
        "needs_clarification",
        "approved",
        "active",
        "paused",
        "closed",
        "archived",
      ],
      work_model: ["remote", "hybrid", "onsite"],
    },
  },
} as const
