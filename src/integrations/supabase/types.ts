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
      admin_copilot_conversations: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_copilot_messages: {
        Row: {
          citations: Json
          confidence: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          latency_ms: number | null
          model: string | null
          proposed_actions: Json
          role: string
          tool_trace: Json
          user_id: string
        }
        Insert: {
          citations?: Json
          confidence?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          proposed_actions?: Json
          role: string
          tool_trace?: Json
          user_id: string
        }
        Update: {
          citations?: Json
          confidence?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          proposed_actions?: Json
          role?: string
          tool_trace?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_copilot_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "admin_copilot_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      application_answers: {
        Row: {
          answer: Json
          application_id: string
          created_at: string
          id: string
          legacy_source_id: string | null
          legacy_source_system: string | null
          legacy_source_table: string | null
          migrated_at: string | null
          migration_run_id: string | null
          migration_status:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version: string | null
          question_id: string
          updated_at: string
        }
        Insert: {
          answer: Json
          application_id: string
          created_at?: string
          id?: string
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          question_id: string
          updated_at?: string
        }
        Update: {
          answer?: Json
          application_id?: string
          created_at?: string
          id?: string
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          question_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_answers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_answers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "application_answers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_source_attribution"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "application_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "screening_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          applied_at: string
          candidate_profile_id: string
          created_at: string
          created_by_audit: boolean | null
          expires_at: string | null
          id: string
          is_test_record: boolean | null
          legacy_source_id: string | null
          legacy_source_system: string | null
          legacy_source_table: string | null
          migrated_at: string | null
          migration_run_id: string | null
          migration_status:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version: string | null
          outreach_replied_at: string | null
          outreach_sent_at: string | null
          position_id: string
          source: string | null
          source_campaign: string | null
          source_channel: string | null
          source_cost_cents: number | null
          source_kind: Database["public"]["Enums"]["source_kind"] | null
          status: Database["public"]["Enums"]["application_status"]
          test_run_id: string | null
          updated_at: string
          withdrawn_at: string | null
        }
        Insert: {
          applied_at?: string
          candidate_profile_id: string
          created_at?: string
          created_by_audit?: boolean | null
          expires_at?: string | null
          id?: string
          is_test_record?: boolean | null
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          outreach_replied_at?: string | null
          outreach_sent_at?: string | null
          position_id: string
          source?: string | null
          source_campaign?: string | null
          source_channel?: string | null
          source_cost_cents?: number | null
          source_kind?: Database["public"]["Enums"]["source_kind"] | null
          status?: Database["public"]["Enums"]["application_status"]
          test_run_id?: string | null
          updated_at?: string
          withdrawn_at?: string | null
        }
        Update: {
          applied_at?: string
          candidate_profile_id?: string
          created_at?: string
          created_by_audit?: boolean | null
          expires_at?: string | null
          id?: string
          is_test_record?: boolean | null
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          outreach_replied_at?: string | null
          outreach_sent_at?: string | null
          position_id?: string
          source?: string | null
          source_campaign?: string | null
          source_channel?: string | null
          source_cost_cents?: number | null
          source_kind?: Database["public"]["Enums"]["source_kind"] | null
          status?: Database["public"]["Enums"]["application_status"]
          test_run_id?: string | null
          updated_at?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "applications_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "applications_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_audit_events: {
        Row: {
          action_id: string | null
          content_preview: string | null
          conversation_id: string | null
          created_at: string
          event_type: string
          id: string
          message_id: string | null
          organization_id: string | null
          payload: Json
          surface: string
          tool_name: string | null
          user_id: string
        }
        Insert: {
          action_id?: string | null
          content_preview?: string | null
          conversation_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          message_id?: string | null
          organization_id?: string | null
          payload?: Json
          surface: string
          tool_name?: string | null
          user_id: string
        }
        Update: {
          action_id?: string | null
          content_preview?: string | null
          conversation_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          message_id?: string | null
          organization_id?: string | null
          payload?: Json
          surface?: string
          tool_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      assistant_conversations: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          organization_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          organization_id: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          citations: Json
          confidence: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          latency_ms: number | null
          model: string | null
          organization_id: string
          proposed_actions: Json
          role: string
          tool_trace: Json
          user_id: string
        }
        Insert: {
          citations?: Json
          confidence?: string | null
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          organization_id: string
          proposed_actions?: Json
          role: string
          tool_trace?: Json
          user_id: string
        }
        Update: {
          citations?: Json
          confidence?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          organization_id?: string
          proposed_actions?: Json
          role?: string
          tool_trace?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "assistant_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          legacy_source_id: string | null
          legacy_source_system: string | null
          legacy_source_table: string | null
          migrated_at: string | null
          migration_run_id: string | null
          migration_status:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version: string | null
          organization_id: string | null
          trace_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          organization_id?: string | null
          trace_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          organization_id?: string | null
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      business_rules_audit: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          key: string
          new_value: Json | null
          note: string | null
          previous_value: Json | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          key: string
          new_value?: Json | null
          note?: string | null
          previous_value?: Json | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          key?: string
          new_value?: Json | null
          note?: string | null
          previous_value?: Json | null
        }
        Relationships: []
      }
      business_rules_overrides: {
        Row: {
          created_at: string
          key: string
          notes: string | null
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          key?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      candidate_evidence: {
        Row: {
          candidate_match_id: string
          candidate_profile_id: string
          created_at: string
          cv_file_id: string | null
          engine_version: string
          extracted: Json
          id: string
          legacy_source_id: string | null
          legacy_source_system: string | null
          legacy_source_table: string | null
          migrated_at: string | null
          migration_run_id: string | null
          migration_status:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version: string | null
          raw_text_sample: string | null
          screening_normalized: Json
        }
        Insert: {
          candidate_match_id: string
          candidate_profile_id: string
          created_at?: string
          cv_file_id?: string | null
          engine_version: string
          extracted?: Json
          id?: string
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          raw_text_sample?: string | null
          screening_normalized?: Json
        }
        Update: {
          candidate_match_id?: string
          candidate_profile_id?: string
          created_at?: string
          cv_file_id?: string | null
          engine_version?: string
          extracted?: Json
          id?: string
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          raw_text_sample?: string | null
          screening_normalized?: Json
        }
        Relationships: [
          {
            foreignKeyName: "candidate_evidence_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evidence_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_work_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evidence_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "candidate_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evidence_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evidence_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_kanban_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evidence_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_visible_candidates"
            referencedColumns: ["candidate_match_id"]
          },
          {
            foreignKeyName: "candidate_evidence_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "v_source_attribution"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "candidate_evidence_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evidence_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evidence_cv_file_id_fkey"
            columns: ["cv_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_evidence_items: {
        Row: {
          candidate_evidence_id: string
          candidate_match_id: string
          confidence: number
          created_at: string
          engine_version: string
          id: string
          integrity_ok: boolean
          last_reviewed_at: string | null
          match_type: string
          model_version: string | null
          normalized_meaning: string
          organization_id: string
          result: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_note: string | null
          reviewer_status: string
          rubric_criterion_key: string
          rubric_dimension_key: string
          source_kind: string | null
          source_location: Json
          source_passage: string
          source_ref: string | null
          supporting_role: string | null
          updated_at: string
          validation_need: string | null
        }
        Insert: {
          candidate_evidence_id: string
          candidate_match_id: string
          confidence: number
          created_at?: string
          engine_version: string
          id?: string
          integrity_ok?: boolean
          last_reviewed_at?: string | null
          match_type: string
          model_version?: string | null
          normalized_meaning: string
          organization_id: string
          result?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          reviewer_status?: string
          rubric_criterion_key: string
          rubric_dimension_key: string
          source_kind?: string | null
          source_location?: Json
          source_passage: string
          source_ref?: string | null
          supporting_role?: string | null
          updated_at?: string
          validation_need?: string | null
        }
        Update: {
          candidate_evidence_id?: string
          candidate_match_id?: string
          confidence?: number
          created_at?: string
          engine_version?: string
          id?: string
          integrity_ok?: boolean
          last_reviewed_at?: string | null
          match_type?: string
          model_version?: string | null
          normalized_meaning?: string
          organization_id?: string
          result?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          reviewer_status?: string
          rubric_criterion_key?: string
          rubric_dimension_key?: string
          source_kind?: string | null
          source_location?: Json
          source_passage?: string
          source_ref?: string | null
          supporting_role?: string | null
          updated_at?: string
          validation_need?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_evidence_items_candidate_evidence_id_fkey"
            columns: ["candidate_evidence_id"]
            isOneToOne: false
            referencedRelation: "candidate_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evidence_items_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evidence_items_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_work_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evidence_items_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "candidate_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evidence_items_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evidence_items_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_kanban_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evidence_items_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_visible_candidates"
            referencedColumns: ["candidate_match_id"]
          },
          {
            foreignKeyName: "candidate_evidence_items_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "v_source_attribution"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "candidate_evidence_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evidence_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evidence_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      candidate_matches: {
        Row: {
          admin_status: Database["public"]["Enums"]["admin_review_status"]
          application_id: string
          approved_score_run_id: string | null
          candidate_profile_id: string
          canonical_state: Database["public"]["Enums"]["canonical_scoring_state"]
          client_visibility: Database["public"]["Enums"]["client_visibility"]
          created_at: string
          created_by_audit: boolean | null
          current_score_run_id: string | null
          delivered_at: string | null
          eligibility_status: Database["public"]["Enums"]["eligibility_status"]
          eligibility_updated_at: string | null
          evidence_confidence: number | null
          expires_at: string | null
          id: string
          integrity_status: Database["public"]["Enums"]["integrity_status"]
          is_test_record: boolean | null
          last_processing_trace_id: string | null
          legacy_source_id: string | null
          legacy_source_system: string | null
          legacy_source_table: string | null
          migrated_at: string | null
          migration_run_id: string | null
          migration_status:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version: string | null
          organization_id: string
          position_id: string
          processing_error_code: string | null
          processing_error_message: string | null
          processing_state: Database["public"]["Enums"]["processing_state"]
          processing_updated_at: string
          recommendation: Database["public"]["Enums"]["recommendation_status"]
          recommendation_reason: string | null
          recommendation_updated_at: string | null
          stage: Database["public"]["Enums"]["match_stage"]
          test_run_id: string | null
          updated_at: string
        }
        Insert: {
          admin_status?: Database["public"]["Enums"]["admin_review_status"]
          application_id: string
          approved_score_run_id?: string | null
          candidate_profile_id: string
          canonical_state?: Database["public"]["Enums"]["canonical_scoring_state"]
          client_visibility?: Database["public"]["Enums"]["client_visibility"]
          created_at?: string
          created_by_audit?: boolean | null
          current_score_run_id?: string | null
          delivered_at?: string | null
          eligibility_status?: Database["public"]["Enums"]["eligibility_status"]
          eligibility_updated_at?: string | null
          evidence_confidence?: number | null
          expires_at?: string | null
          id?: string
          integrity_status?: Database["public"]["Enums"]["integrity_status"]
          is_test_record?: boolean | null
          last_processing_trace_id?: string | null
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          organization_id: string
          position_id: string
          processing_error_code?: string | null
          processing_error_message?: string | null
          processing_state?: Database["public"]["Enums"]["processing_state"]
          processing_updated_at?: string
          recommendation?: Database["public"]["Enums"]["recommendation_status"]
          recommendation_reason?: string | null
          recommendation_updated_at?: string | null
          stage?: Database["public"]["Enums"]["match_stage"]
          test_run_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_status?: Database["public"]["Enums"]["admin_review_status"]
          application_id?: string
          approved_score_run_id?: string | null
          candidate_profile_id?: string
          canonical_state?: Database["public"]["Enums"]["canonical_scoring_state"]
          client_visibility?: Database["public"]["Enums"]["client_visibility"]
          created_at?: string
          created_by_audit?: boolean | null
          current_score_run_id?: string | null
          delivered_at?: string | null
          eligibility_status?: Database["public"]["Enums"]["eligibility_status"]
          eligibility_updated_at?: string | null
          evidence_confidence?: number | null
          expires_at?: string | null
          id?: string
          integrity_status?: Database["public"]["Enums"]["integrity_status"]
          is_test_record?: boolean | null
          last_processing_trace_id?: string | null
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          organization_id?: string
          position_id?: string
          processing_error_code?: string | null
          processing_error_message?: string | null
          processing_state?: Database["public"]["Enums"]["processing_state"]
          processing_updated_at?: string
          recommendation?: Database["public"]["Enums"]["recommendation_status"]
          recommendation_reason?: string | null
          recommendation_updated_at?: string | null
          stage?: Database["public"]["Enums"]["match_stage"]
          test_run_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_matches_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "candidate_matches_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "v_source_attribution"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "candidate_matches_approved_score_run_id_fkey"
            columns: ["approved_score_run_id"]
            isOneToOne: false
            referencedRelation: "score_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_current_score_run_id_fkey"
            columns: ["current_score_run_id"]
            isOneToOne: false
            referencedRelation: "score_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_profiles: {
        Row: {
          availability: Json
          certifications: Json
          compensation_preferences: Json
          consent: Json
          created_at: string
          created_by_audit: boolean | null
          current_cv_file_id: string | null
          education: Json
          email: string
          experience: Json
          expires_at: string | null
          full_name: string
          headline: string | null
          id: string
          is_test_record: boolean | null
          languages: Json
          legacy_source_id: string | null
          legacy_source_system: string | null
          legacy_source_table: string | null
          linkedin_url: string | null
          location: string | null
          migrated_at: string | null
          migration_run_id: string | null
          migration_status:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version: string | null
          phone: string | null
          portfolio_url: string | null
          skills: Json
          summary: string | null
          test_run_id: string | null
          timezone: string | null
          updated_at: string
          user_id: string | null
          work_authorization: Json
          years_experience: number | null
        }
        Insert: {
          availability?: Json
          certifications?: Json
          compensation_preferences?: Json
          consent?: Json
          created_at?: string
          created_by_audit?: boolean | null
          current_cv_file_id?: string | null
          education?: Json
          email: string
          experience?: Json
          expires_at?: string | null
          full_name: string
          headline?: string | null
          id?: string
          is_test_record?: boolean | null
          languages?: Json
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          linkedin_url?: string | null
          location?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          phone?: string | null
          portfolio_url?: string | null
          skills?: Json
          summary?: string | null
          test_run_id?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string | null
          work_authorization?: Json
          years_experience?: number | null
        }
        Update: {
          availability?: Json
          certifications?: Json
          compensation_preferences?: Json
          consent?: Json
          created_at?: string
          created_by_audit?: boolean | null
          current_cv_file_id?: string | null
          education?: Json
          email?: string
          experience?: Json
          expires_at?: string | null
          full_name?: string
          headline?: string | null
          id?: string
          is_test_record?: boolean | null
          languages?: Json
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          linkedin_url?: string | null
          location?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          phone?: string | null
          portfolio_url?: string | null
          skills?: Json
          summary?: string | null
          test_run_id?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string | null
          work_authorization?: Json
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_profiles_cv_fk"
            columns: ["current_cv_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_stage_history: {
        Row: {
          actor_role: string | null
          actor_user_id: string | null
          candidate_match_id: string
          candidate_profile_id: string
          created_at: string
          from_stage: string | null
          id: string
          metadata: Json
          organization_id: string
          position_id: string
          reason: string | null
          to_stage: string
          trace_id: string | null
        }
        Insert: {
          actor_role?: string | null
          actor_user_id?: string | null
          candidate_match_id: string
          candidate_profile_id: string
          created_at?: string
          from_stage?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          position_id: string
          reason?: string | null
          to_stage: string
          trace_id?: string | null
        }
        Update: {
          actor_role?: string | null
          actor_user_id?: string | null
          candidate_match_id?: string
          candidate_profile_id?: string
          created_at?: string
          from_stage?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          position_id?: string
          reason?: string | null
          to_stage?: string
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_stage_history_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_stage_history_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_work_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_stage_history_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "candidate_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_stage_history_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_stage_history_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_kanban_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_stage_history_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_visible_candidates"
            referencedColumns: ["candidate_match_id"]
          },
          {
            foreignKeyName: "candidate_stage_history_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "v_source_attribution"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "candidate_stage_history_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_stage_history_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_stage_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_stage_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_stage_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "candidate_stage_history_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "candidate_stage_history_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_stage_history_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "candidate_stage_history_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_stage_history_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      client_decisions: {
        Row: {
          actor_user_id: string | null
          candidate_match_id: string
          created_at: string
          decision: Database["public"]["Enums"]["client_decision_type"]
          feedback: string | null
          id: string
          legacy_source_id: string | null
          legacy_source_system: string | null
          legacy_source_table: string | null
          migrated_at: string | null
          migration_run_id: string | null
          migration_status:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          actor_user_id?: string | null
          candidate_match_id: string
          created_at?: string
          decision: Database["public"]["Enums"]["client_decision_type"]
          feedback?: string | null
          id?: string
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          actor_user_id?: string | null
          candidate_match_id?: string
          created_at?: string
          decision?: Database["public"]["Enums"]["client_decision_type"]
          feedback?: string | null
          id?: string
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_decisions_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_decisions_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_work_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_decisions_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "candidate_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_decisions_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_decisions_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_kanban_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_decisions_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_visible_candidates"
            referencedColumns: ["candidate_match_id"]
          },
          {
            foreignKeyName: "client_decisions_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "v_source_attribution"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "client_decisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_decisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_decisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      client_notification_preferences: {
        Row: {
          candidate_delivered: boolean
          created_at: string
          digest: string
          email_enabled: boolean
          hire_update: boolean
          interview_request: boolean
          new_message: boolean
          offer_update: boolean
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          candidate_delivered?: boolean
          created_at?: string
          digest?: string
          email_enabled?: boolean
          hire_update?: boolean
          interview_request?: boolean
          new_message?: boolean
          offer_update?: boolean
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          candidate_delivered?: boolean
          created_at?: string
          digest?: string
          email_enabled?: boolean
          hire_update?: boolean
          interview_request?: boolean
          new_message?: boolean
          offer_update?: boolean
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notification_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notification_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notification_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      consent_records: {
        Row: {
          candidate_profile_id: string | null
          consent_type: string
          context: Json
          created_at: string
          granted: boolean
          granted_at: string
          id: string
          ip_address: unknown
          legacy_source_id: string | null
          legacy_source_system: string | null
          legacy_source_table: string | null
          migrated_at: string | null
          migration_run_id: string | null
          migration_status:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version: string | null
          policy_version: string
          source: string
          subject_email: string | null
          user_agent: string | null
          withdrawn_at: string | null
        }
        Insert: {
          candidate_profile_id?: string | null
          consent_type: string
          context?: Json
          created_at?: string
          granted: boolean
          granted_at?: string
          id?: string
          ip_address?: unknown
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          policy_version: string
          source: string
          subject_email?: string | null
          user_agent?: string | null
          withdrawn_at?: string | null
        }
        Update: {
          candidate_profile_id?: string | null
          consent_type?: string
          context?: Json
          created_at?: string
          granted?: boolean
          granted_at?: string
          id?: string
          ip_address?: unknown
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          policy_version?: string
          source?: string
          subject_email?: string | null
          user_agent?: string | null
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          source: string | null
          topic: string
          user_agent: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          source?: string | null
          topic: string
          user_agent?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          source?: string | null
          topic?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      cost_limits: {
        Row: {
          id: string
          max_bytes_per_op: number | null
          notes: string | null
          operation: string
          per_entity_daily_cap: number
          per_org_daily_cap: number
          per_platform_hourly_cap: number
          updated_at: string
        }
        Insert: {
          id?: string
          max_bytes_per_op?: number | null
          notes?: string | null
          operation: string
          per_entity_daily_cap: number
          per_org_daily_cap: number
          per_platform_hourly_cap: number
          updated_at?: string
        }
        Update: {
          id?: string
          max_bytes_per_op?: number | null
          notes?: string | null
          operation?: string
          per_entity_daily_cap?: number
          per_org_daily_cap?: number
          per_platform_hourly_cap?: number
          updated_at?: string
        }
        Relationships: []
      }
      data_subject_requests: {
        Row: {
          candidate_profile_id: string | null
          completed_at: string | null
          details: Json
          due_at: string
          export_file_id: string | null
          handled_by: string | null
          id: string
          received_at: string
          reference_code: string
          request_type: string
          resolution_note: string | null
          status: string
          subject_email: string
          trace_id: string | null
        }
        Insert: {
          candidate_profile_id?: string | null
          completed_at?: string | null
          details?: Json
          due_at?: string
          export_file_id?: string | null
          handled_by?: string | null
          id?: string
          received_at?: string
          reference_code: string
          request_type: string
          resolution_note?: string | null
          status?: string
          subject_email: string
          trace_id?: string | null
        }
        Update: {
          candidate_profile_id?: string | null
          completed_at?: string | null
          details?: Json
          due_at?: string
          export_file_id?: string | null
          handled_by?: string | null
          id?: string
          received_at?: string
          reference_code?: string
          request_type?: string
          resolution_note?: string | null
          status?: string
          subject_email?: string
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_subject_requests_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_subject_requests_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_subject_requests_export_file_id_fkey"
            columns: ["export_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      eligibility_checks: {
        Row: {
          actor_user_id: string | null
          candidate_match_id: string
          created_at: string
          evidence: Json
          id: string
          organization_id: string
          position_id: string
          qualifier_key: string
          qualifier_kind: string
          qualifier_label: string
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actor_user_id?: string | null
          candidate_match_id: string
          created_at?: string
          evidence?: Json
          id?: string
          organization_id: string
          position_id: string
          qualifier_key: string
          qualifier_kind: string
          qualifier_label: string
          reason?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          actor_user_id?: string | null
          candidate_match_id?: string
          created_at?: string
          evidence?: Json
          id?: string
          organization_id?: string
          position_id?: string
          qualifier_key?: string
          qualifier_kind?: string
          qualifier_label?: string
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eligibility_checks_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_checks_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_work_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_checks_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "candidate_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_checks_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_checks_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_kanban_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_checks_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_visible_candidates"
            referencedColumns: ["candidate_match_id"]
          },
          {
            foreignKeyName: "eligibility_checks_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "v_source_attribution"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "eligibility_checks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_checks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_checks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "eligibility_checks_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "eligibility_checks_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_checks_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "eligibility_checks_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_checks_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      eligibility_exceptions: {
        Row: {
          candidate_match_id: string
          created_at: string
          eligibility_check_id: string
          expires_at: string | null
          granted_by: string
          id: string
          organization_id: string
          reason: string
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          updated_at: string
        }
        Insert: {
          candidate_match_id: string
          created_at?: string
          eligibility_check_id: string
          expires_at?: string | null
          granted_by: string
          id?: string
          organization_id: string
          reason: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          updated_at?: string
        }
        Update: {
          candidate_match_id?: string
          created_at?: string
          eligibility_check_id?: string
          expires_at?: string | null
          granted_by?: string
          id?: string
          organization_id?: string
          reason?: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eligibility_exceptions_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_exceptions_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_work_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_exceptions_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "candidate_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_exceptions_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_exceptions_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_kanban_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_exceptions_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_visible_candidates"
            referencedColumns: ["candidate_match_id"]
          },
          {
            foreignKeyName: "eligibility_exceptions_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "v_source_attribution"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "eligibility_exceptions_eligibility_check_id_fkey"
            columns: ["eligibility_check_id"]
            isOneToOne: false
            referencedRelation: "eligibility_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_exceptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_exceptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_exceptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      evidence_overrides: {
        Row: {
          actor_user_id: string | null
          after_state: Json
          before_state: Json
          candidate_match_id: string
          created_at: string
          evidence_item_id: string
          id: string
          organization_id: string
          reason: string
        }
        Insert: {
          actor_user_id?: string | null
          after_state: Json
          before_state: Json
          candidate_match_id: string
          created_at?: string
          evidence_item_id: string
          id?: string
          organization_id: string
          reason: string
        }
        Update: {
          actor_user_id?: string | null
          after_state?: Json
          before_state?: Json
          candidate_match_id?: string
          created_at?: string
          evidence_item_id?: string
          id?: string
          organization_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_overrides_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_overrides_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_work_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_overrides_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "candidate_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_overrides_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_overrides_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_kanban_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_overrides_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_visible_candidates"
            referencedColumns: ["candidate_match_id"]
          },
          {
            foreignKeyName: "evidence_overrides_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "v_source_attribution"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "evidence_overrides_evidence_item_id_fkey"
            columns: ["evidence_item_id"]
            isOneToOne: false
            referencedRelation: "candidate_evidence_client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_overrides_evidence_item_id_fkey"
            columns: ["evidence_item_id"]
            isOneToOne: false
            referencedRelation: "candidate_evidence_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      export_jobs: {
        Row: {
          completed_at: string | null
          data_freshness_at: string | null
          error: string | null
          expires_at: string | null
          export_type: string
          filters: Json
          id: string
          organization_id: string | null
          output_file_id: string | null
          requested_at: string
          requested_by: string
          row_count: number | null
          status: string
          trace_id: string | null
        }
        Insert: {
          completed_at?: string | null
          data_freshness_at?: string | null
          error?: string | null
          expires_at?: string | null
          export_type: string
          filters?: Json
          id?: string
          organization_id?: string | null
          output_file_id?: string | null
          requested_at?: string
          requested_by: string
          row_count?: number | null
          status?: string
          trace_id?: string | null
        }
        Update: {
          completed_at?: string | null
          data_freshness_at?: string | null
          error?: string | null
          expires_at?: string | null
          export_type?: string
          filters?: Json
          id?: string
          organization_id?: string | null
          output_file_id?: string | null
          requested_at?: string
          requested_by?: string
          row_count?: number | null
          status?: string
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "export_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "export_jobs_output_file_id_fkey"
            columns: ["output_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          candidate_profile_id: string | null
          checksum: string | null
          created_at: string
          created_by_audit: boolean | null
          expires_at: string | null
          extracted_text: string | null
          extraction_attempts: number
          extraction_completed_at: string | null
          file_status: Database["public"]["Enums"]["file_status"]
          filename: string
          id: string
          is_test_record: boolean | null
          legacy_source_id: string | null
          legacy_source_system: string | null
          legacy_source_table: string | null
          migrated_at: string | null
          migration_run_id: string | null
          migration_status:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version: string | null
          mime_type: string | null
          ocr_used: boolean
          owner_user_id: string | null
          size: number | null
          storage_bucket: string
          storage_path: string
          test_run_id: string | null
        }
        Insert: {
          candidate_profile_id?: string | null
          checksum?: string | null
          created_at?: string
          created_by_audit?: boolean | null
          expires_at?: string | null
          extracted_text?: string | null
          extraction_attempts?: number
          extraction_completed_at?: string | null
          file_status?: Database["public"]["Enums"]["file_status"]
          filename: string
          id?: string
          is_test_record?: boolean | null
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          mime_type?: string | null
          ocr_used?: boolean
          owner_user_id?: string | null
          size?: number | null
          storage_bucket: string
          storage_path: string
          test_run_id?: string | null
        }
        Update: {
          candidate_profile_id?: string | null
          checksum?: string | null
          created_at?: string
          created_by_audit?: boolean | null
          expires_at?: string | null
          extracted_text?: string | null
          extraction_attempts?: number
          extraction_completed_at?: string | null
          file_status?: Database["public"]["Enums"]["file_status"]
          filename?: string
          id?: string
          is_test_record?: boolean | null
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          mime_type?: string | null
          ocr_used?: boolean
          owner_user_id?: string | null
          size?: number | null
          storage_bucket?: string
          storage_path?: string
          test_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hire_records: {
        Row: {
          accepted_at: string | null
          application_id: string | null
          bonus_notes: string | null
          candidate_match_id: string
          candidate_profile_id: string
          close_reason: Database["public"]["Enums"]["hire_close_reason"] | null
          close_reason_notes: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          declined_at: string | null
          drafted_at: string | null
          employment_type: string | null
          equity_notes: string | null
          hired_at: string | null
          id: string
          location: string | null
          offer_notes: string | null
          organization_id: string
          owner_user_id: string | null
          position_id: string
          salary_amount: number | null
          salary_currency: string | null
          salary_period: string | null
          sent_at: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["hire_status"]
          updated_at: string
          work_model: string | null
        }
        Insert: {
          accepted_at?: string | null
          application_id?: string | null
          bonus_notes?: string | null
          candidate_match_id: string
          candidate_profile_id: string
          close_reason?: Database["public"]["Enums"]["hire_close_reason"] | null
          close_reason_notes?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          declined_at?: string | null
          drafted_at?: string | null
          employment_type?: string | null
          equity_notes?: string | null
          hired_at?: string | null
          id?: string
          location?: string | null
          offer_notes?: string | null
          organization_id: string
          owner_user_id?: string | null
          position_id: string
          salary_amount?: number | null
          salary_currency?: string | null
          salary_period?: string | null
          sent_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["hire_status"]
          updated_at?: string
          work_model?: string | null
        }
        Update: {
          accepted_at?: string | null
          application_id?: string | null
          bonus_notes?: string | null
          candidate_match_id?: string
          candidate_profile_id?: string
          close_reason?: Database["public"]["Enums"]["hire_close_reason"] | null
          close_reason_notes?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          declined_at?: string | null
          drafted_at?: string | null
          employment_type?: string | null
          equity_notes?: string | null
          hired_at?: string | null
          id?: string
          location?: string | null
          offer_notes?: string | null
          organization_id?: string
          owner_user_id?: string | null
          position_id?: string
          salary_amount?: number | null
          salary_currency?: string | null
          salary_period?: string | null
          sent_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["hire_status"]
          updated_at?: string
          work_model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hire_records_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hire_records_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "hire_records_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_source_attribution"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "hire_records_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: true
            referencedRelation: "admin_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hire_records_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: true
            referencedRelation: "admin_work_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hire_records_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: true
            referencedRelation: "candidate_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hire_records_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: true
            referencedRelation: "client_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hire_records_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: true
            referencedRelation: "client_kanban_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hire_records_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: true
            referencedRelation: "client_visible_candidates"
            referencedColumns: ["candidate_match_id"]
          },
          {
            foreignKeyName: "hire_records_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: true
            referencedRelation: "v_source_attribution"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "hire_records_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hire_records_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hire_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hire_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hire_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "hire_records_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "hire_records_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hire_records_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "hire_records_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hire_records_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_submissions: {
        Row: {
          company_name: string
          created_at: string
          id: string
          idempotency_key: string
          legacy_source_id: string | null
          legacy_source_system: string | null
          legacy_source_table: string | null
          migrated_at: string | null
          migration_run_id: string | null
          migration_status:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version: string | null
          organization_id: string | null
          payload: Json
          position_id: string | null
          primary_email: string
          primary_user_id: string | null
          requisition_pending: boolean
          role_title: string
          source: string
          status: string
          trace_id: string | null
          updated_at: string
          workspace_status: string
        }
        Insert: {
          company_name: string
          created_at?: string
          id?: string
          idempotency_key: string
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          organization_id?: string | null
          payload?: Json
          position_id?: string | null
          primary_email: string
          primary_user_id?: string | null
          requisition_pending?: boolean
          role_title: string
          source?: string
          status?: string
          trace_id?: string | null
          updated_at?: string
          workspace_status?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          organization_id?: string | null
          payload?: Json
          position_id?: string | null
          primary_email?: string
          primary_user_id?: string | null
          requisition_pending?: boolean
          role_title?: string
          source?: string
          status?: string
          trace_id?: string | null
          updated_at?: string
          workspace_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "intake_submissions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "intake_submissions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_submissions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "intake_submissions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_submissions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          candidate_match_id: string
          candidate_submission_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          feedback: string | null
          id: string
          interview_type: string | null
          legacy_source_id: string | null
          legacy_source_system: string | null
          legacy_source_table: string | null
          location: string | null
          meeting_url: string | null
          migrated_at: string | null
          migration_run_id: string | null
          migration_status:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version: string | null
          notes: string | null
          organization_id: string
          participants: Json
          position_id: string
          proposed_times: Json
          requested_at: string
          scheduled_at: string | null
          status: Database["public"]["Enums"]["interview_status"]
          timezone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          candidate_match_id: string
          candidate_submission_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          feedback?: string | null
          id?: string
          interview_type?: string | null
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          location?: string | null
          meeting_url?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          notes?: string | null
          organization_id: string
          participants?: Json
          position_id: string
          proposed_times?: Json
          requested_at?: string
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          timezone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          candidate_match_id?: string
          candidate_submission_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          feedback?: string | null
          id?: string
          interview_type?: string | null
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          location?: string | null
          meeting_url?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          notes?: string | null
          organization_id?: string
          participants?: Json
          position_id?: string
          proposed_times?: Json
          requested_at?: string
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          timezone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interviews_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_work_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "candidate_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_kanban_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_visible_candidates"
            referencedColumns: ["candidate_match_id"]
          },
          {
            foreignKeyName: "interviews_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "v_source_attribution"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "interviews_candidate_submission_id_fkey"
            columns: ["candidate_submission_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_candidate_submission_id_fkey"
            columns: ["candidate_submission_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "interviews_candidate_submission_id_fkey"
            columns: ["candidate_submission_id"]
            isOneToOne: false
            referencedRelation: "v_source_attribution"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "interviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "interviews_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "interviews_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "interviews_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_application_map: {
        Row: {
          checksum: string | null
          created_at: string
          destination_id: string | null
          destination_table: string
          error_code: string | null
          error_detail: string | null
          id: string
          matched_by: string | null
          migrated_at: string | null
          migration_run_id: string
          migration_status: Database["public"]["Enums"]["migration_row_status"]
          payload: Json | null
          source_id: string
          source_system: string
          source_table: string
          updated_at: string
          validation_status: Database["public"]["Enums"]["migration_validation_status"]
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          destination_id?: string | null
          destination_table: string
          error_code?: string | null
          error_detail?: string | null
          id?: string
          matched_by?: string | null
          migrated_at?: string | null
          migration_run_id: string
          migration_status?: Database["public"]["Enums"]["migration_row_status"]
          payload?: Json | null
          source_id: string
          source_system?: string
          source_table: string
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["migration_validation_status"]
        }
        Update: {
          checksum?: string | null
          created_at?: string
          destination_id?: string | null
          destination_table?: string
          error_code?: string | null
          error_detail?: string | null
          id?: string
          matched_by?: string | null
          migrated_at?: string | null
          migration_run_id?: string
          migration_status?: Database["public"]["Enums"]["migration_row_status"]
          payload?: Json | null
          source_id?: string
          source_system?: string
          source_table?: string
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["migration_validation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "legacy_application_map_migration_run_id_fkey"
            columns: ["migration_run_id"]
            isOneToOne: false
            referencedRelation: "migration_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_candidate_map: {
        Row: {
          checksum: string | null
          created_at: string
          destination_id: string | null
          destination_table: string
          error_code: string | null
          error_detail: string | null
          id: string
          matched_by: string | null
          migrated_at: string | null
          migration_run_id: string
          migration_status: Database["public"]["Enums"]["migration_row_status"]
          payload: Json | null
          source_id: string
          source_system: string
          source_table: string
          updated_at: string
          validation_status: Database["public"]["Enums"]["migration_validation_status"]
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          destination_id?: string | null
          destination_table: string
          error_code?: string | null
          error_detail?: string | null
          id?: string
          matched_by?: string | null
          migrated_at?: string | null
          migration_run_id: string
          migration_status?: Database["public"]["Enums"]["migration_row_status"]
          payload?: Json | null
          source_id: string
          source_system?: string
          source_table: string
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["migration_validation_status"]
        }
        Update: {
          checksum?: string | null
          created_at?: string
          destination_id?: string | null
          destination_table?: string
          error_code?: string | null
          error_detail?: string | null
          id?: string
          matched_by?: string | null
          migrated_at?: string | null
          migration_run_id?: string
          migration_status?: Database["public"]["Enums"]["migration_row_status"]
          payload?: Json | null
          source_id?: string
          source_system?: string
          source_table?: string
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["migration_validation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "legacy_candidate_map_migration_run_id_fkey"
            columns: ["migration_run_id"]
            isOneToOne: false
            referencedRelation: "migration_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_file_map: {
        Row: {
          checksum: string | null
          created_at: string
          destination_id: string | null
          destination_table: string
          error_code: string | null
          error_detail: string | null
          id: string
          matched_by: string | null
          migrated_at: string | null
          migration_run_id: string
          migration_status: Database["public"]["Enums"]["migration_row_status"]
          payload: Json | null
          source_id: string
          source_system: string
          source_table: string
          updated_at: string
          validation_status: Database["public"]["Enums"]["migration_validation_status"]
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          destination_id?: string | null
          destination_table: string
          error_code?: string | null
          error_detail?: string | null
          id?: string
          matched_by?: string | null
          migrated_at?: string | null
          migration_run_id: string
          migration_status?: Database["public"]["Enums"]["migration_row_status"]
          payload?: Json | null
          source_id: string
          source_system?: string
          source_table: string
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["migration_validation_status"]
        }
        Update: {
          checksum?: string | null
          created_at?: string
          destination_id?: string | null
          destination_table?: string
          error_code?: string | null
          error_detail?: string | null
          id?: string
          matched_by?: string | null
          migrated_at?: string | null
          migration_run_id?: string
          migration_status?: Database["public"]["Enums"]["migration_row_status"]
          payload?: Json | null
          source_id?: string
          source_system?: string
          source_table?: string
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["migration_validation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "legacy_file_map_migration_run_id_fkey"
            columns: ["migration_run_id"]
            isOneToOne: false
            referencedRelation: "migration_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_identity_map: {
        Row: {
          checksum: string | null
          created_at: string
          destination_id: string | null
          destination_table: string
          error_code: string | null
          error_detail: string | null
          id: string
          matched_by: string | null
          migrated_at: string | null
          migration_run_id: string
          migration_status: Database["public"]["Enums"]["migration_row_status"]
          payload: Json | null
          source_id: string
          source_system: string
          source_table: string
          updated_at: string
          validation_status: Database["public"]["Enums"]["migration_validation_status"]
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          destination_id?: string | null
          destination_table: string
          error_code?: string | null
          error_detail?: string | null
          id?: string
          matched_by?: string | null
          migrated_at?: string | null
          migration_run_id: string
          migration_status?: Database["public"]["Enums"]["migration_row_status"]
          payload?: Json | null
          source_id: string
          source_system?: string
          source_table: string
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["migration_validation_status"]
        }
        Update: {
          checksum?: string | null
          created_at?: string
          destination_id?: string | null
          destination_table?: string
          error_code?: string | null
          error_detail?: string | null
          id?: string
          matched_by?: string | null
          migrated_at?: string | null
          migration_run_id?: string
          migration_status?: Database["public"]["Enums"]["migration_row_status"]
          payload?: Json | null
          source_id?: string
          source_system?: string
          source_table?: string
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["migration_validation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "legacy_identity_map_migration_run_id_fkey"
            columns: ["migration_run_id"]
            isOneToOne: false
            referencedRelation: "migration_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_organization_map: {
        Row: {
          checksum: string | null
          created_at: string
          destination_id: string | null
          destination_table: string
          error_code: string | null
          error_detail: string | null
          id: string
          matched_by: string | null
          migrated_at: string | null
          migration_run_id: string
          migration_status: Database["public"]["Enums"]["migration_row_status"]
          payload: Json | null
          source_id: string
          source_system: string
          source_table: string
          updated_at: string
          validation_status: Database["public"]["Enums"]["migration_validation_status"]
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          destination_id?: string | null
          destination_table: string
          error_code?: string | null
          error_detail?: string | null
          id?: string
          matched_by?: string | null
          migrated_at?: string | null
          migration_run_id: string
          migration_status?: Database["public"]["Enums"]["migration_row_status"]
          payload?: Json | null
          source_id: string
          source_system?: string
          source_table: string
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["migration_validation_status"]
        }
        Update: {
          checksum?: string | null
          created_at?: string
          destination_id?: string | null
          destination_table?: string
          error_code?: string | null
          error_detail?: string | null
          id?: string
          matched_by?: string | null
          migrated_at?: string | null
          migration_run_id?: string
          migration_status?: Database["public"]["Enums"]["migration_row_status"]
          payload?: Json | null
          source_id?: string
          source_system?: string
          source_table?: string
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["migration_validation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "legacy_organization_map_migration_run_id_fkey"
            columns: ["migration_run_id"]
            isOneToOne: false
            referencedRelation: "migration_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_position_map: {
        Row: {
          checksum: string | null
          created_at: string
          destination_id: string | null
          destination_table: string
          error_code: string | null
          error_detail: string | null
          id: string
          matched_by: string | null
          migrated_at: string | null
          migration_run_id: string
          migration_status: Database["public"]["Enums"]["migration_row_status"]
          payload: Json | null
          source_id: string
          source_system: string
          source_table: string
          updated_at: string
          validation_status: Database["public"]["Enums"]["migration_validation_status"]
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          destination_id?: string | null
          destination_table: string
          error_code?: string | null
          error_detail?: string | null
          id?: string
          matched_by?: string | null
          migrated_at?: string | null
          migration_run_id: string
          migration_status?: Database["public"]["Enums"]["migration_row_status"]
          payload?: Json | null
          source_id: string
          source_system?: string
          source_table: string
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["migration_validation_status"]
        }
        Update: {
          checksum?: string | null
          created_at?: string
          destination_id?: string | null
          destination_table?: string
          error_code?: string | null
          error_detail?: string | null
          id?: string
          matched_by?: string | null
          migrated_at?: string | null
          migration_run_id?: string
          migration_status?: Database["public"]["Enums"]["migration_row_status"]
          payload?: Json | null
          source_id?: string
          source_system?: string
          source_table?: string
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["migration_validation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "legacy_position_map_migration_run_id_fkey"
            columns: ["migration_run_id"]
            isOneToOne: false
            referencedRelation: "migration_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_score_map: {
        Row: {
          checksum: string | null
          created_at: string
          destination_id: string | null
          destination_table: string
          error_code: string | null
          error_detail: string | null
          id: string
          matched_by: string | null
          migrated_at: string | null
          migration_run_id: string
          migration_status: Database["public"]["Enums"]["migration_row_status"]
          payload: Json | null
          source_id: string
          source_system: string
          source_table: string
          updated_at: string
          validation_status: Database["public"]["Enums"]["migration_validation_status"]
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          destination_id?: string | null
          destination_table: string
          error_code?: string | null
          error_detail?: string | null
          id?: string
          matched_by?: string | null
          migrated_at?: string | null
          migration_run_id: string
          migration_status?: Database["public"]["Enums"]["migration_row_status"]
          payload?: Json | null
          source_id: string
          source_system?: string
          source_table: string
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["migration_validation_status"]
        }
        Update: {
          checksum?: string | null
          created_at?: string
          destination_id?: string | null
          destination_table?: string
          error_code?: string | null
          error_detail?: string | null
          id?: string
          matched_by?: string | null
          migrated_at?: string | null
          migration_run_id?: string
          migration_status?: Database["public"]["Enums"]["migration_row_status"]
          payload?: Json | null
          source_id?: string
          source_system?: string
          source_table?: string
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["migration_validation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "legacy_score_map_migration_run_id_fkey"
            columns: ["migration_run_id"]
            isOneToOne: false
            referencedRelation: "migration_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_submission_map: {
        Row: {
          checksum: string | null
          created_at: string
          destination_id: string | null
          destination_table: string
          error_code: string | null
          error_detail: string | null
          id: string
          matched_by: string | null
          migrated_at: string | null
          migration_run_id: string
          migration_status: Database["public"]["Enums"]["migration_row_status"]
          payload: Json | null
          source_id: string
          source_system: string
          source_table: string
          updated_at: string
          validation_status: Database["public"]["Enums"]["migration_validation_status"]
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          destination_id?: string | null
          destination_table: string
          error_code?: string | null
          error_detail?: string | null
          id?: string
          matched_by?: string | null
          migrated_at?: string | null
          migration_run_id: string
          migration_status?: Database["public"]["Enums"]["migration_row_status"]
          payload?: Json | null
          source_id: string
          source_system?: string
          source_table: string
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["migration_validation_status"]
        }
        Update: {
          checksum?: string | null
          created_at?: string
          destination_id?: string | null
          destination_table?: string
          error_code?: string | null
          error_detail?: string | null
          id?: string
          matched_by?: string | null
          migrated_at?: string | null
          migration_run_id?: string
          migration_status?: Database["public"]["Enums"]["migration_row_status"]
          payload?: Json | null
          source_id?: string
          source_system?: string
          source_table?: string
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["migration_validation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "legacy_submission_map_migration_run_id_fkey"
            columns: ["migration_run_id"]
            isOneToOne: false
            referencedRelation: "migration_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_inquiries: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          industry_slug: string | null
          kind: string
          message: string | null
          name: string
          preferred_slot: string | null
          role_count: string | null
          role_title: string | null
          source_path: string | null
          status: string
          user_agent: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          industry_slug?: string | null
          kind: string
          message?: string | null
          name: string
          preferred_slot?: string | null
          role_count?: string | null
          role_title?: string | null
          source_path?: string | null
          status?: string
          user_agent?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          industry_slug?: string | null
          kind?: string
          message?: string | null
          name?: string
          preferred_slot?: string | null
          role_count?: string | null
          role_title?: string | null
          source_path?: string | null
          status?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      memberships: {
        Row: {
          created_at: string
          created_by_audit: boolean | null
          expires_at: string | null
          id: string
          is_master_admin: boolean
          is_test_record: boolean | null
          legacy_source_id: string | null
          legacy_source_system: string | null
          legacy_source_table: string | null
          migrated_at: string | null
          migration_run_id: string | null
          migration_status:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version: string | null
          organization_id: string
          role: Database["public"]["Enums"]["membership_role"]
          status: Database["public"]["Enums"]["membership_status"]
          test_run_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by_audit?: boolean | null
          expires_at?: string | null
          id?: string
          is_master_admin?: boolean
          is_test_record?: boolean | null
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          organization_id: string
          role: Database["public"]["Enums"]["membership_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          test_run_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by_audit?: boolean | null
          expires_at?: string | null
          id?: string
          is_master_admin?: boolean
          is_test_record?: boolean | null
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          test_run_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          legacy_source_id: string | null
          legacy_source_system: string | null
          legacy_source_table: string | null
          migrated_at: string | null
          migration_run_id: string | null
          migration_status:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version: string | null
          read_at: string | null
          recipient_context: Json
          sender_user_id: string | null
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          read_at?: string | null
          recipient_context?: Json
          sender_user_id?: string | null
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          read_at?: string | null
          recipient_context?: Json
          sender_user_id?: string | null
          thread_id?: string
        }
        Relationships: []
      }
      migration_entity_results: {
        Row: {
          created_at: string
          destination_table: string
          duration_ms: number | null
          entity: string
          finished_at: string | null
          id: string
          imported_count: number
          migration_run_id: string
          planned_count: number
          rejected_count: number
          skipped_count: number
          source_table: string
          started_at: string | null
          updated_at: string
          validation_status: Database["public"]["Enums"]["migration_validation_status"]
          verified_count: number
        }
        Insert: {
          created_at?: string
          destination_table: string
          duration_ms?: number | null
          entity: string
          finished_at?: string | null
          id?: string
          imported_count?: number
          migration_run_id: string
          planned_count?: number
          rejected_count?: number
          skipped_count?: number
          source_table: string
          started_at?: string | null
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["migration_validation_status"]
          verified_count?: number
        }
        Update: {
          created_at?: string
          destination_table?: string
          duration_ms?: number | null
          entity?: string
          finished_at?: string | null
          id?: string
          imported_count?: number
          migration_run_id?: string
          planned_count?: number
          rejected_count?: number
          skipped_count?: number
          source_table?: string
          started_at?: string | null
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["migration_validation_status"]
          verified_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "migration_entity_results_migration_run_id_fkey"
            columns: ["migration_run_id"]
            isOneToOne: false
            referencedRelation: "migration_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_rejections: {
        Row: {
          checksum: string | null
          created_at: string
          destination_table: string | null
          entity: string
          error_code: string
          error_detail: string | null
          id: string
          migration_run_id: string
          payload: Json | null
          resolution_note: string | null
          resolved: boolean
          resolved_at: string | null
          source_id: string
          source_system: string
          source_table: string
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          destination_table?: string | null
          entity: string
          error_code: string
          error_detail?: string | null
          id?: string
          migration_run_id: string
          payload?: Json | null
          resolution_note?: string | null
          resolved?: boolean
          resolved_at?: string | null
          source_id: string
          source_system?: string
          source_table: string
        }
        Update: {
          checksum?: string | null
          created_at?: string
          destination_table?: string | null
          entity?: string
          error_code?: string
          error_detail?: string | null
          id?: string
          migration_run_id?: string
          payload?: Json | null
          resolution_note?: string | null
          resolved?: boolean
          resolved_at?: string | null
          source_id?: string
          source_system?: string
          source_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "migration_rejections_migration_run_id_fkey"
            columns: ["migration_run_id"]
            isOneToOne: false
            referencedRelation: "migration_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_runs: {
        Row: {
          created_at: string
          created_by: string | null
          dry_run: boolean
          finished_at: string | null
          id: string
          imported_count: number
          migration_version: string
          notes: string | null
          planned_count: number
          rejected_count: number
          run_key: string
          skipped_count: number
          source_project_ref: string | null
          source_system: string
          started_at: string | null
          status: Database["public"]["Enums"]["migration_run_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dry_run?: boolean
          finished_at?: string | null
          id?: string
          imported_count?: number
          migration_version: string
          notes?: string | null
          planned_count?: number
          rejected_count?: number
          run_key: string
          skipped_count?: number
          source_project_ref?: string | null
          source_system?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["migration_run_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dry_run?: boolean
          finished_at?: string | null
          id?: string
          imported_count?: number
          migration_version?: string
          notes?: string | null
          planned_count?: number
          rejected_count?: number
          run_key?: string
          skipped_count?: number
          source_project_ref?: string | null
          source_system?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["migration_run_status"]
          updated_at?: string
        }
        Relationships: []
      }
      notification_deliveries: {
        Row: {
          channel: Database["public"]["Enums"]["delivery_channel"]
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          notification_id: string
          provider_message_id: string | null
          status: Database["public"]["Enums"]["delivery_status"]
          updated_at: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["delivery_channel"]
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          notification_id: string
          provider_message_id?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["delivery_channel"]
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          notification_id?: string
          provider_message_id?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          actor_user_id: string | null
          application_id: string | null
          candidate_match_id: string | null
          candidate_profile_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          idempotency_key: string
          organization_id: string | null
          payload: Json
          position_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          application_id?: string | null
          candidate_match_id?: string | null
          candidate_profile_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["event_type"]
          id?: string
          idempotency_key: string
          organization_id?: string | null
          payload?: Json
          position_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          application_id?: string | null
          candidate_match_id?: string | null
          candidate_profile_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          idempotency_key?: string
          organization_id?: string | null
          payload?: Json
          position_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "notification_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_source_attribution"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "notification_events_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_work_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "candidate_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_kanban_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_visible_candidates"
            referencedColumns: ["candidate_match_id"]
          },
          {
            foreignKeyName: "notification_events_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "v_source_attribution"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "notification_events_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "notification_events_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "notification_events_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "notification_events_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          audience: Database["public"]["Enums"]["notification_audience"]
          body: string | null
          created_at: string
          event_id: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          legacy_source_id: string | null
          legacy_source_system: string | null
          legacy_source_table: string | null
          link_path: string | null
          migrated_at: string | null
          migration_run_id: string | null
          migration_status:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version: string | null
          organization_id: string | null
          read_at: string | null
          recipient_user_id: string
          title: string
        }
        Insert: {
          audience: Database["public"]["Enums"]["notification_audience"]
          body?: string | null
          created_at?: string
          event_id?: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          id?: string
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          link_path?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          organization_id?: string | null
          read_at?: string | null
          recipient_user_id: string
          title: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["notification_audience"]
          body?: string | null
          created_at?: string
          event_id?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          link_path?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          organization_id?: string | null
          read_at?: string | null
          recipient_user_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      organizations: {
        Row: {
          archived_at: string | null
          brand_accent_color: string | null
          brand_display_name: string | null
          brand_primary_color: string | null
          created_at: string
          created_by_audit: boolean | null
          dashboard_status: string
          domain: string | null
          expires_at: string | null
          headquarters: string | null
          id: string
          industry: string | null
          internal_notes: string | null
          is_test_record: boolean | null
          legacy_source_id: string | null
          legacy_source_system: string | null
          legacy_source_table: string | null
          locations: string | null
          logo_url: string | null
          migrated_at: string | null
          migration_run_id: string | null
          migration_status:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version: string | null
          name: string
          name_normalized: string | null
          onboarding_status: string
          parent_organization_id: string | null
          phone: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          status: Database["public"]["Enums"]["org_status"]
          test_run_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          archived_at?: string | null
          brand_accent_color?: string | null
          brand_display_name?: string | null
          brand_primary_color?: string | null
          created_at?: string
          created_by_audit?: boolean | null
          dashboard_status?: string
          domain?: string | null
          expires_at?: string | null
          headquarters?: string | null
          id?: string
          industry?: string | null
          internal_notes?: string | null
          is_test_record?: boolean | null
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          locations?: string | null
          logo_url?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          name: string
          name_normalized?: string | null
          onboarding_status?: string
          parent_organization_id?: string | null
          phone?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          test_run_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          archived_at?: string | null
          brand_accent_color?: string | null
          brand_display_name?: string | null
          brand_primary_color?: string | null
          created_at?: string
          created_by_audit?: boolean | null
          dashboard_status?: string
          domain?: string | null
          expires_at?: string | null
          headquarters?: string | null
          id?: string
          industry?: string | null
          internal_notes?: string | null
          is_test_record?: boolean | null
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          locations?: string | null
          logo_url?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          name?: string
          name_normalized?: string | null
          onboarding_status?: string
          parent_organization_id?: string | null
          phone?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          test_run_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_parent_organization_id_fkey"
            columns: ["parent_organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_parent_organization_id_fkey"
            columns: ["parent_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_parent_organization_id_fkey"
            columns: ["parent_organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      outreach_campaigns: {
        Row: {
          channel: Database["public"]["Enums"]["outreach_channel"]
          created_at: string
          ended_at: string | null
          id: string
          is_test_record: boolean
          name: string
          notes: string | null
          organization_id: string
          owner_user_id: string | null
          position_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["outreach_campaign_status"]
          target_count: number | null
          updated_at: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["outreach_channel"]
          created_at?: string
          ended_at?: string | null
          id?: string
          is_test_record?: boolean
          name: string
          notes?: string | null
          organization_id: string
          owner_user_id?: string | null
          position_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["outreach_campaign_status"]
          target_count?: number | null
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["outreach_channel"]
          created_at?: string
          ended_at?: string | null
          id?: string
          is_test_record?: boolean
          name?: string
          notes?: string | null
          organization_id?: string
          owner_user_id?: string | null
          position_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["outreach_campaign_status"]
          target_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "outreach_campaigns_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "outreach_campaigns_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "outreach_campaigns_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_touches: {
        Row: {
          application_id: string | null
          campaign_id: string
          candidate_profile_id: string | null
          channel: Database["public"]["Enums"]["outreach_channel"]
          created_at: string
          delivered_at: string | null
          engagement_state:
            | Database["public"]["Enums"]["outreach_engagement_state"]
            | null
          error: string | null
          id: string
          is_test_record: boolean
          organization_id: string
          replied_at: string | null
          reply_category:
            | Database["public"]["Enums"]["outreach_reply_category"]
            | null
          sent_at: string | null
          state: Database["public"]["Enums"]["outreach_touch_state"]
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          campaign_id: string
          candidate_profile_id?: string | null
          channel: Database["public"]["Enums"]["outreach_channel"]
          created_at?: string
          delivered_at?: string | null
          engagement_state?:
            | Database["public"]["Enums"]["outreach_engagement_state"]
            | null
          error?: string | null
          id?: string
          is_test_record?: boolean
          organization_id: string
          replied_at?: string | null
          reply_category?:
            | Database["public"]["Enums"]["outreach_reply_category"]
            | null
          sent_at?: string | null
          state?: Database["public"]["Enums"]["outreach_touch_state"]
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          campaign_id?: string
          candidate_profile_id?: string | null
          channel?: Database["public"]["Enums"]["outreach_channel"]
          created_at?: string
          delivered_at?: string | null
          engagement_state?:
            | Database["public"]["Enums"]["outreach_engagement_state"]
            | null
          error?: string | null
          id?: string
          is_test_record?: boolean
          organization_id?: string
          replied_at?: string | null
          reply_category?:
            | Database["public"]["Enums"]["outreach_reply_category"]
            | null
          sent_at?: string | null
          state?: Database["public"]["Enums"]["outreach_touch_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_touches_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_touches_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "outreach_touches_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_source_attribution"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "outreach_touches_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "outreach_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_touches_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "v_outreach_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_touches_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_touches_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_touches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_touches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_touches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      position_versions: {
        Row: {
          compensation: Json | null
          created_at: string
          created_by: string | null
          dealbreakers: Json
          description: string | null
          id: string
          intake_context: Json | null
          organization_id: string
          position_id: string
          preferred_requirements: Json
          requirements: Json
          snapshot: Json
          title: string
          version_number: number
        }
        Insert: {
          compensation?: Json | null
          created_at?: string
          created_by?: string | null
          dealbreakers?: Json
          description?: string | null
          id?: string
          intake_context?: Json | null
          organization_id: string
          position_id: string
          preferred_requirements?: Json
          requirements?: Json
          snapshot?: Json
          title: string
          version_number: number
        }
        Update: {
          compensation?: Json | null
          created_at?: string
          created_by?: string | null
          dealbreakers?: Json
          description?: string | null
          id?: string
          intake_context?: Json | null
          organization_id?: string
          position_id?: string
          preferred_requirements?: Json
          requirements?: Json
          snapshot?: Json
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "position_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "position_versions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "position_versions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_versions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "position_versions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_versions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          approved_at: string | null
          business_unit: string | null
          closed_at: string | null
          compensation: Json
          created_at: string
          created_by: string | null
          created_by_audit: boolean | null
          dealbreakers: Json
          department: string | null
          description: string | null
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          expires_at: string | null
          id: string
          intake_context: Json
          is_test_record: boolean | null
          legacy_source_id: string | null
          legacy_source_system: string | null
          legacy_source_table: string | null
          location: string | null
          migrated_at: string | null
          migration_run_id: string | null
          migration_status:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version: string | null
          openings: number
          organization_id: string
          preferred_requirements: Json
          published_at: string | null
          region: string | null
          requirements: Json
          seniority: string | null
          status: Database["public"]["Enums"]["position_status"]
          submitted_at: string | null
          test_run_id: string | null
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["position_visibility"]
          work_authorization: Json
          work_model: Database["public"]["Enums"]["work_model"] | null
        }
        Insert: {
          approved_at?: string | null
          business_unit?: string | null
          closed_at?: string | null
          compensation?: Json
          created_at?: string
          created_by?: string | null
          created_by_audit?: boolean | null
          dealbreakers?: Json
          department?: string | null
          description?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          expires_at?: string | null
          id?: string
          intake_context?: Json
          is_test_record?: boolean | null
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          location?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          openings?: number
          organization_id: string
          preferred_requirements?: Json
          published_at?: string | null
          region?: string | null
          requirements?: Json
          seniority?: string | null
          status?: Database["public"]["Enums"]["position_status"]
          submitted_at?: string | null
          test_run_id?: string | null
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["position_visibility"]
          work_authorization?: Json
          work_model?: Database["public"]["Enums"]["work_model"] | null
        }
        Update: {
          approved_at?: string | null
          business_unit?: string | null
          closed_at?: string | null
          compensation?: Json
          created_at?: string
          created_by?: string | null
          created_by_audit?: boolean | null
          dealbreakers?: Json
          department?: string | null
          description?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          expires_at?: string | null
          id?: string
          intake_context?: Json
          is_test_record?: boolean | null
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          location?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          openings?: number
          organization_id?: string
          preferred_requirements?: Json
          published_at?: string | null
          region?: string | null
          requirements?: Json
          seniority?: string | null
          status?: Database["public"]["Enums"]["position_status"]
          submitted_at?: string | null
          test_run_id?: string | null
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["position_visibility"]
          work_authorization?: Json
          work_model?: Database["public"]["Enums"]["work_model"] | null
        }
        Relationships: [
          {
            foreignKeyName: "positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      processing_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          entity_id: string
          entity_type: string
          error_code: string | null
          error_message: string | null
          id: string
          job_type: string
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          trace_id: string | null
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          job_type: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          trace_id?: string | null
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          trace_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auth_user_id: string
          client_onboarding_dismissed_at: string | null
          created_at: string
          created_by_audit: boolean | null
          email: string
          expires_at: string | null
          full_name: string | null
          id: string
          is_test_record: boolean | null
          legacy_source_id: string | null
          legacy_source_system: string | null
          legacy_source_table: string | null
          locale: string | null
          migrated_at: string | null
          migration_run_id: string | null
          migration_status:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version: string | null
          phone: string | null
          status: Database["public"]["Enums"]["profile_status"]
          test_run_id: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          client_onboarding_dismissed_at?: string | null
          created_at?: string
          created_by_audit?: boolean | null
          email: string
          expires_at?: string | null
          full_name?: string | null
          id?: string
          is_test_record?: boolean | null
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          locale?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          test_run_id?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          client_onboarding_dismissed_at?: string | null
          created_at?: string
          created_by_audit?: boolean | null
          email?: string
          expires_at?: string | null
          full_name?: string | null
          id?: string
          is_test_record?: boolean | null
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          locale?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          test_run_id?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      provider_usage_events: {
        Row: {
          bytes: number | null
          cost_estimate_micros: number | null
          entity_id: string | null
          entity_type: string | null
          error_code: string | null
          id: string
          latency_ms: number | null
          occurred_at: string
          operation: string
          organization_id: string | null
          provider: string
          success: boolean
          tokens_in: number | null
          tokens_out: number | null
          trace_id: string | null
        }
        Insert: {
          bytes?: number | null
          cost_estimate_micros?: number | null
          entity_id?: string | null
          entity_type?: string | null
          error_code?: string | null
          id?: string
          latency_ms?: number | null
          occurred_at?: string
          operation: string
          organization_id?: string | null
          provider: string
          success?: boolean
          tokens_in?: number | null
          tokens_out?: number | null
          trace_id?: string | null
        }
        Update: {
          bytes?: number | null
          cost_estimate_micros?: number | null
          entity_id?: string | null
          entity_type?: string | null
          error_code?: string | null
          id?: string
          latency_ms?: number | null
          occurred_at?: string
          operation?: string
          organization_id?: string | null
          provider?: string
          success?: boolean
          tokens_in?: number | null
          tokens_out?: number | null
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      retention_policies: {
        Row: {
          action: string
          data_class: string
          entity: string
          id: string
          legal_basis: string
          notes: string | null
          retention_days: number | null
          updated_at: string
        }
        Insert: {
          action: string
          data_class: string
          entity: string
          id?: string
          legal_basis: string
          notes?: string | null
          retention_days?: number | null
          updated_at?: string
        }
        Update: {
          action?: string
          data_class?: string
          entity?: string
          id?: string
          legal_basis?: string
          notes?: string | null
          retention_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      retention_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          policy_id: string
          rows_affected: number | null
          started_at: string
          status: string
          trace_id: string | null
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          policy_id: string
          rows_affected?: number | null
          started_at?: string
          status?: string
          trace_id?: string | null
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          policy_id?: string
          rows_affected?: number | null
          started_at?: string
          status?: string
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retention_runs_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "retention_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      role_memory: {
        Row: {
          author_display_name: string | null
          author_user_id: string
          body: string
          candidate_profile_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["role_memory_kind"]
          organization_id: string
          pinned: boolean
          position_id: string
          title: string
          updated_at: string
        }
        Insert: {
          author_display_name?: string | null
          author_user_id: string
          body: string
          candidate_profile_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["role_memory_kind"]
          organization_id: string
          pinned?: boolean
          position_id: string
          title: string
          updated_at?: string
        }
        Update: {
          author_display_name?: string | null
          author_user_id?: string
          body?: string
          candidate_profile_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["role_memory_kind"]
          organization_id?: string
          pinned?: boolean
          position_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_memory_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_memory_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_memory_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_memory_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_memory_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "role_memory_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "role_memory_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_memory_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "role_memory_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_memory_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      rubric_templates: {
        Row: {
          blueprint: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          industry: string | null
          is_active: boolean
          name: string
          role_family: string | null
          slug: string
          template_type: string
          updated_at: string
        }
        Insert: {
          blueprint?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean
          name: string
          role_family?: string | null
          slug: string
          template_type: string
          updated_at?: string
        }
        Update: {
          blueprint?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean
          name?: string
          role_family?: string | null
          slug?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      rubric_versions: {
        Row: {
          anchors: Json
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          dimensions: Json
          id: string
          label: string
          organization_id: string
          position_id: string
          qualifiers: Json
          snapshot: Json
          status: Database["public"]["Enums"]["rubric_version_status"]
          superseded_at: string | null
          updated_at: string
          version_number: number
          weights: Json
        }
        Insert: {
          anchors?: Json
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          dimensions?: Json
          id?: string
          label: string
          organization_id: string
          position_id: string
          qualifiers?: Json
          snapshot?: Json
          status?: Database["public"]["Enums"]["rubric_version_status"]
          superseded_at?: string | null
          updated_at?: string
          version_number: number
          weights?: Json
        }
        Update: {
          anchors?: Json
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          dimensions?: Json
          id?: string
          label?: string
          organization_id?: string
          position_id?: string
          qualifiers?: Json
          snapshot?: Json
          status?: Database["public"]["Enums"]["rubric_version_status"]
          superseded_at?: string | null
          updated_at?: string
          version_number?: number
          weights?: Json
        }
        Relationships: [
          {
            foreignKeyName: "rubric_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubric_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubric_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "rubric_versions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "rubric_versions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubric_versions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "rubric_versions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubric_versions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_views: {
        Row: {
          created_at: string
          filters: Json
          id: string
          is_default: boolean
          is_shared: boolean
          name: string
          organization_id: string | null
          surface: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean
          is_shared?: boolean
          name: string
          organization_id?: string | null
          surface: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean
          is_shared?: boolean
          name?: string
          organization_id?: string | null
          surface?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_views_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_views_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_views_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      score_decisions: {
        Row: {
          actor_user_id: string | null
          approved_score: number | null
          candidate_match_id: string
          created_at: string
          decision_type: Database["public"]["Enums"]["score_decision_type"]
          id: string
          reason: string | null
          score_run_id: string
        }
        Insert: {
          actor_user_id?: string | null
          approved_score?: number | null
          candidate_match_id: string
          created_at?: string
          decision_type: Database["public"]["Enums"]["score_decision_type"]
          id?: string
          reason?: string | null
          score_run_id: string
        }
        Update: {
          actor_user_id?: string | null
          approved_score?: number | null
          candidate_match_id?: string
          created_at?: string
          decision_type?: Database["public"]["Enums"]["score_decision_type"]
          id?: string
          reason?: string | null
          score_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_decisions_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_decisions_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_work_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_decisions_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "candidate_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_decisions_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_decisions_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_kanban_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_decisions_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_visible_candidates"
            referencedColumns: ["candidate_match_id"]
          },
          {
            foreignKeyName: "score_decisions_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "v_source_attribution"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "score_decisions_score_run_id_fkey"
            columns: ["score_run_id"]
            isOneToOne: false
            referencedRelation: "score_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      score_runs: {
        Row: {
          application_id: string
          applied_cap: number
          blueprint_version: string
          candidate_match_id: string
          candidate_profile_id: string
          candidate_submission_id: string
          completed_at: string | null
          confidence: number | null
          contradiction_status: string | null
          created_by_audit: boolean
          engine_version: string
          error_code: string | null
          evaluation_method: string | null
          evidence: Json
          evidence_confidence: number | null
          expires_at: string | null
          explanation: string | null
          final_score: number
          fit_band: string
          fit_label: string | null
          id: string
          input_hash: string | null
          is_test_record: boolean
          legacy_source_id: string | null
          legacy_source_system: string | null
          legacy_source_table: string | null
          migrated_at: string | null
          migration_run_id: string | null
          migration_status:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version: string | null
          must_have_coverage: number | null
          organization_id: string
          position_id: string
          preferred_coverage: number | null
          raw_score: number
          requirement_coverage: Json
          result: Json
          rubric_version_id: string | null
          score: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["score_status"]
          test_run_id: string | null
          trace_id: string | null
        }
        Insert: {
          application_id: string
          applied_cap: number
          blueprint_version: string
          candidate_match_id: string
          candidate_profile_id: string
          candidate_submission_id: string
          completed_at?: string | null
          confidence?: number | null
          contradiction_status?: string | null
          created_by_audit?: boolean
          engine_version: string
          error_code?: string | null
          evaluation_method?: string | null
          evidence?: Json
          evidence_confidence?: number | null
          expires_at?: string | null
          explanation?: string | null
          final_score: number
          fit_band: string
          fit_label?: string | null
          id?: string
          input_hash?: string | null
          is_test_record?: boolean
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          must_have_coverage?: number | null
          organization_id: string
          position_id: string
          preferred_coverage?: number | null
          raw_score: number
          requirement_coverage?: Json
          result?: Json
          rubric_version_id?: string | null
          score?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["score_status"]
          test_run_id?: string | null
          trace_id?: string | null
        }
        Update: {
          application_id?: string
          applied_cap?: number
          blueprint_version?: string
          candidate_match_id?: string
          candidate_profile_id?: string
          candidate_submission_id?: string
          completed_at?: string | null
          confidence?: number | null
          contradiction_status?: string | null
          created_by_audit?: boolean
          engine_version?: string
          error_code?: string | null
          evaluation_method?: string | null
          evidence?: Json
          evidence_confidence?: number | null
          expires_at?: string | null
          explanation?: string | null
          final_score?: number
          fit_band?: string
          fit_label?: string | null
          id?: string
          input_hash?: string | null
          is_test_record?: boolean
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          must_have_coverage?: number | null
          organization_id?: string
          position_id?: string
          preferred_coverage?: number | null
          raw_score?: number
          requirement_coverage?: Json
          result?: Json
          rubric_version_id?: string | null
          score?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["score_status"]
          test_run_id?: string | null
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "score_runs_application_fk"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_runs_application_fk"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "score_runs_application_fk"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_source_attribution"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "score_runs_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_runs_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_work_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_runs_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "candidate_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_runs_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_runs_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_kanban_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_runs_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_visible_candidates"
            referencedColumns: ["candidate_match_id"]
          },
          {
            foreignKeyName: "score_runs_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "v_source_attribution"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "score_runs_candidate_profile_fk"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_runs_candidate_profile_fk"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_runs_organization_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_runs_organization_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_runs_organization_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "score_runs_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "score_runs_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_runs_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "score_runs_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_runs_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_runs_rubric_version_id_fkey"
            columns: ["rubric_version_id"]
            isOneToOne: false
            referencedRelation: "rubric_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_debug_events: {
        Row: {
          candidate_match_id: string
          created_at: string
          detail: Json
          duration_ms: number | null
          engine_version: string
          error_message: string | null
          event_type: string
          id: string
          model_version: string | null
          organization_id: string
          retry_count: number
          rubric_criterion_key: string | null
          score_run_id: string
        }
        Insert: {
          candidate_match_id: string
          created_at?: string
          detail?: Json
          duration_ms?: number | null
          engine_version: string
          error_message?: string | null
          event_type: string
          id?: string
          model_version?: string | null
          organization_id: string
          retry_count?: number
          rubric_criterion_key?: string | null
          score_run_id: string
        }
        Update: {
          candidate_match_id?: string
          created_at?: string
          detail?: Json
          duration_ms?: number | null
          engine_version?: string
          error_message?: string | null
          event_type?: string
          id?: string
          model_version?: string | null
          organization_id?: string
          retry_count?: number
          rubric_criterion_key?: string | null
          score_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoring_debug_events_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_debug_events_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_work_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_debug_events_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "candidate_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_debug_events_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_debug_events_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_kanban_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_debug_events_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_visible_candidates"
            referencedColumns: ["candidate_match_id"]
          },
          {
            foreignKeyName: "scoring_debug_events_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "v_source_attribution"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "scoring_debug_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_debug_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_debug_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "scoring_debug_events_score_run_id_fkey"
            columns: ["score_run_id"]
            isOneToOne: false
            referencedRelation: "score_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_orphans: {
        Row: {
          candidate_match_id: string | null
          detail: Json
          detected_at: string
          id: string
          organization_id: string | null
          reason: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          score_run_id: string | null
        }
        Insert: {
          candidate_match_id?: string | null
          detail?: Json
          detected_at?: string
          id?: string
          organization_id?: string | null
          reason: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          score_run_id?: string | null
        }
        Update: {
          candidate_match_id?: string | null
          detail?: Json
          detected_at?: string
          id?: string
          organization_id?: string | null
          reason?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          score_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scoring_orphans_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_orphans_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_work_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_orphans_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "candidate_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_orphans_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_orphans_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_kanban_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_orphans_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_visible_candidates"
            referencedColumns: ["candidate_match_id"]
          },
          {
            foreignKeyName: "scoring_orphans_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "v_source_attribution"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "scoring_orphans_score_run_id_fkey"
            columns: ["score_run_id"]
            isOneToOne: false
            referencedRelation: "score_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_questions: {
        Row: {
          answer_type: Database["public"]["Enums"]["answer_type"]
          created_at: string
          dealbreaker: boolean
          display_order: number
          id: string
          legacy_source_id: string | null
          legacy_source_system: string | null
          legacy_source_table: string | null
          migrated_at: string | null
          migration_run_id: string | null
          migration_status:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version: string | null
          options: Json | null
          position_id: string
          preferred_answer: Json | null
          question: string
          required: boolean
          scoring_weight: number
          updated_at: string
        }
        Insert: {
          answer_type?: Database["public"]["Enums"]["answer_type"]
          created_at?: string
          dealbreaker?: boolean
          display_order?: number
          id?: string
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          options?: Json | null
          position_id: string
          preferred_answer?: Json | null
          question: string
          required?: boolean
          scoring_weight?: number
          updated_at?: string
        }
        Update: {
          answer_type?: Database["public"]["Enums"]["answer_type"]
          created_at?: string
          dealbreaker?: boolean
          display_order?: number
          id?: string
          legacy_source_id?: string | null
          legacy_source_system?: string | null
          legacy_source_table?: string | null
          migrated_at?: string | null
          migration_run_id?: string | null
          migration_status?:
            | Database["public"]["Enums"]["migration_row_status"]
            | null
          migration_version?: string | null
          options?: Json | null
          position_id?: string
          preferred_answer?: Json | null
          question?: string
          required?: boolean
          scoring_weight?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "screening_questions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "screening_questions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_questions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "screening_questions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_questions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      shortlist_share_comments: {
        Row: {
          author_email: string | null
          author_name: string
          body: string
          created_at: string
          id: string
          match_id: string | null
          sentiment: string | null
          share_id: string
        }
        Insert: {
          author_email?: string | null
          author_name: string
          body: string
          created_at?: string
          id?: string
          match_id?: string | null
          sentiment?: string | null
          share_id: string
        }
        Update: {
          author_email?: string | null
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          match_id?: string | null
          sentiment?: string | null
          share_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shortlist_share_comments_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "shortlist_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      shortlist_shares: {
        Row: {
          allow_comments: boolean
          created_at: string
          created_by: string
          default_mode: Database["public"]["Enums"]["shortlist_share_mode"]
          expires_at: string
          id: string
          last_viewed_at: string | null
          match_ids: string[]
          message: string | null
          organization_id: string
          position_id: string | null
          revoked_at: string | null
          title: string | null
          token: string
          updated_at: string
          view_count: number
        }
        Insert: {
          allow_comments?: boolean
          created_at?: string
          created_by: string
          default_mode?: Database["public"]["Enums"]["shortlist_share_mode"]
          expires_at: string
          id?: string
          last_viewed_at?: string | null
          match_ids: string[]
          message?: string | null
          organization_id: string
          position_id?: string | null
          revoked_at?: string | null
          title?: string | null
          token: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          allow_comments?: boolean
          created_at?: string
          created_by?: string
          default_mode?: Database["public"]["Enums"]["shortlist_share_mode"]
          expires_at?: string
          id?: string
          last_viewed_at?: string | null
          match_ids?: string[]
          message?: string | null
          organization_id?: string
          position_id?: string | null
          revoked_at?: string | null
          title?: string | null
          token?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "shortlist_shares_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shortlist_shares_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shortlist_shares_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "shortlist_shares_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "shortlist_shares_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shortlist_shares_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "shortlist_shares_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shortlist_shares_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      support_actions: {
        Row: {
          action: string
          actor_user_id: string
          after_state: Json | null
          before_state: Json | null
          id: string
          occurred_at: string
          organization_id: string | null
          reason: string
          session_id: string | null
          target_id: string | null
          target_type: string
          trace_id: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          after_state?: Json | null
          before_state?: Json | null
          id?: string
          occurred_at?: string
          organization_id?: string | null
          reason: string
          session_id?: string | null
          target_id?: string | null
          target_type: string
          trace_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          after_state?: Json | null
          before_state?: Json | null
          id?: string
          occurred_at?: string
          organization_id?: string | null
          reason?: string
          session_id?: string | null
          target_id?: string | null
          target_type?: string
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "support_actions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "support_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      support_sessions: {
        Row: {
          actor_role: string
          actor_user_id: string
          end_reason: string | null
          ended_at: string | null
          expires_at: string
          id: string
          mode: string
          organization_id: string | null
          permission_preview: string
          reason: string
          scope: string
          started_at: string
          target_role_snapshot: string | null
          target_user_id: string
          ticket_ref: string | null
          trace_id: string
        }
        Insert: {
          actor_role: string
          actor_user_id: string
          end_reason?: string | null
          ended_at?: string | null
          expires_at: string
          id?: string
          mode?: string
          organization_id?: string | null
          permission_preview?: string
          reason?: string
          scope?: string
          started_at?: string
          target_role_snapshot?: string | null
          target_user_id: string
          ticket_ref?: string | null
          trace_id: string
        }
        Update: {
          actor_role?: string
          actor_user_id?: string
          end_reason?: string | null
          ended_at?: string | null
          expires_at?: string
          id?: string
          mode?: string
          organization_id?: string | null
          permission_preview?: string
          reason?: string
          scope?: string
          started_at?: string
          target_role_snapshot?: string | null
          target_user_id?: string
          ticket_ref?: string | null
          trace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      talent_memory: {
        Row: {
          candidate_profile_id: string
          consent_expires_at: string | null
          consent_status: Database["public"]["Enums"]["silver_consent"]
          consent_updated_at: string | null
          created_at: string
          headline_snapshot: string | null
          id: string
          last_reengaged_at: string | null
          last_resurfaced_at: string | null
          organization_id: string
          owner_user_id: string | null
          reason_category: Database["public"]["Enums"]["silver_reason"]
          reason_notes: string | null
          role_title_snapshot: string | null
          score_snapshot: number | null
          seniority_snapshot: string | null
          skills_snapshot: Json
          source_match_id: string | null
          source_position_id: string | null
          status: string
          tagged_at: string
          tagged_by: string | null
          updated_at: string
        }
        Insert: {
          candidate_profile_id: string
          consent_expires_at?: string | null
          consent_status?: Database["public"]["Enums"]["silver_consent"]
          consent_updated_at?: string | null
          created_at?: string
          headline_snapshot?: string | null
          id?: string
          last_reengaged_at?: string | null
          last_resurfaced_at?: string | null
          organization_id: string
          owner_user_id?: string | null
          reason_category: Database["public"]["Enums"]["silver_reason"]
          reason_notes?: string | null
          role_title_snapshot?: string | null
          score_snapshot?: number | null
          seniority_snapshot?: string | null
          skills_snapshot?: Json
          source_match_id?: string | null
          source_position_id?: string | null
          status?: string
          tagged_at?: string
          tagged_by?: string | null
          updated_at?: string
        }
        Update: {
          candidate_profile_id?: string
          consent_expires_at?: string | null
          consent_status?: Database["public"]["Enums"]["silver_consent"]
          consent_updated_at?: string | null
          created_at?: string
          headline_snapshot?: string | null
          id?: string
          last_reengaged_at?: string | null
          last_resurfaced_at?: string | null
          organization_id?: string
          owner_user_id?: string | null
          reason_category?: Database["public"]["Enums"]["silver_reason"]
          reason_notes?: string | null
          role_title_snapshot?: string | null
          score_snapshot?: number | null
          seniority_snapshot?: string | null
          skills_snapshot?: Json
          source_match_id?: string | null
          source_position_id?: string | null
          status?: string
          tagged_at?: string
          tagged_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_memory_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_memory_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_memory_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_memory_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_memory_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "talent_memory_source_match_id_fkey"
            columns: ["source_match_id"]
            isOneToOne: false
            referencedRelation: "admin_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_memory_source_match_id_fkey"
            columns: ["source_match_id"]
            isOneToOne: false
            referencedRelation: "admin_work_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_memory_source_match_id_fkey"
            columns: ["source_match_id"]
            isOneToOne: false
            referencedRelation: "candidate_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_memory_source_match_id_fkey"
            columns: ["source_match_id"]
            isOneToOne: false
            referencedRelation: "client_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_memory_source_match_id_fkey"
            columns: ["source_match_id"]
            isOneToOne: false
            referencedRelation: "client_kanban_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_memory_source_match_id_fkey"
            columns: ["source_match_id"]
            isOneToOne: false
            referencedRelation: "client_visible_candidates"
            referencedColumns: ["candidate_match_id"]
          },
          {
            foreignKeyName: "talent_memory_source_match_id_fkey"
            columns: ["source_match_id"]
            isOneToOne: false
            referencedRelation: "v_source_attribution"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "talent_memory_source_position_id_fkey"
            columns: ["source_position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "talent_memory_source_position_id_fkey"
            columns: ["source_position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_memory_source_position_id_fkey"
            columns: ["source_position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "talent_memory_source_position_id_fkey"
            columns: ["source_position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_memory_source_position_id_fkey"
            columns: ["source_position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_memory_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          notes: string | null
          organization_id: string
          position_id: string | null
          talent_memory_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          notes?: string | null
          organization_id: string
          position_id?: string | null
          talent_memory_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          notes?: string | null
          organization_id?: string
          position_id?: string | null
          talent_memory_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_memory_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_memory_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_memory_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "talent_memory_events_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "talent_memory_events_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_memory_events_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "talent_memory_events_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_memory_events_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_memory_events_talent_memory_id_fkey"
            columns: ["talent_memory_id"]
            isOneToOne: false
            referencedRelation: "talent_memory"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_pool_members: {
        Row: {
          added_at: string
          added_by: string | null
          candidate_profile_id: string
          id: string
          notes: string | null
          organization_id: string
          pool_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          candidate_profile_id: string
          id?: string
          notes?: string | null
          organization_id: string
          pool_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          candidate_profile_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          pool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_pool_members_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_pool_members_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_pool_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_pool_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_pool_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "talent_pool_members_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "talent_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_pools: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_system: boolean
          name: string
          organization_id: string
          system_key: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          organization_id: string
          system_key?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          organization_id?: string
          system_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_pools_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_pools_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_pools_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      tasks: {
        Row: {
          approved_version_hash: string | null
          assignee_user_id: string | null
          blocking: boolean
          candidate_match_id: string | null
          candidate_profile_id: string | null
          collaborators: string[]
          completed_at: string | null
          completed_by: string | null
          completion_evidence: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          due_at: string | null
          id: string
          metadata: Json
          organization_id: string
          position_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          reminder_policy: string
          status: Database["public"]["Enums"]["task_status"]
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_version_hash?: string | null
          assignee_user_id?: string | null
          blocking?: boolean
          candidate_match_id?: string | null
          candidate_profile_id?: string | null
          collaborators?: string[]
          completed_at?: string | null
          completed_by?: string | null
          completion_evidence?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          position_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          reminder_policy?: string
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_version_hash?: string | null
          assignee_user_id?: string | null
          blocking?: boolean
          candidate_match_id?: string | null
          candidate_profile_id?: string | null
          collaborators?: string[]
          completed_at?: string | null
          completed_by?: string | null
          completion_evidence?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          position_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          reminder_policy?: string
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_work_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "candidate_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_kanban_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_visible_candidates"
            referencedColumns: ["candidate_match_id"]
          },
          {
            foreignKeyName: "tasks_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "v_source_attribution"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "tasks_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "tasks_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "tasks_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "tasks_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      trace_index: {
        Row: {
          action: string
          actor_user_id: string | null
          failure_reason: string | null
          http_status: number | null
          occurred_at: string
          organization_id: string | null
          reference_id: string
          request_summary: Json | null
          result: string
          trace_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          failure_reason?: string | null
          http_status?: number | null
          occurred_at?: string
          organization_id?: string | null
          reference_id: string
          request_summary?: Json | null
          result: string
          trace_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          failure_reason?: string | null
          http_status?: number | null
          occurred_at?: string
          organization_id?: string | null
          reference_id?: string
          request_summary?: Json | null
          result?: string
          trace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trace_index_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trace_index_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trace_index_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
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
      admin_candidate_matches_view: {
        Row: {
          admin_status:
            | Database["public"]["Enums"]["admin_review_status"]
            | null
          application_id: string | null
          candidate_profile_id: string | null
          client_visibility:
            | Database["public"]["Enums"]["client_visibility"]
            | null
          created_at: string | null
          delivered_at: string | null
          email: string | null
          full_name: string | null
          id: string | null
          latest_score: number | null
          organization_id: string | null
          organization_name: string | null
          position_id: string | null
          position_title: string | null
          stage: Database["public"]["Enums"]["match_stage"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_matches_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "candidate_matches_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "v_source_attribution"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "candidate_matches_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_clients_view: {
        Row: {
          active_positions: number | null
          created_at: string | null
          domain: string | null
          headquarters: string | null
          id: string | null
          industry: string | null
          name: string | null
          name_normalized: string | null
          status: Database["public"]["Enums"]["org_status"] | null
          total_positions: number | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          active_positions?: never
          created_at?: string | null
          domain?: string | null
          headquarters?: string | null
          id?: string | null
          industry?: string | null
          name?: string | null
          name_normalized?: string | null
          status?: Database["public"]["Enums"]["org_status"] | null
          total_positions?: never
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          active_positions?: never
          created_at?: string | null
          domain?: string | null
          headquarters?: string | null
          id?: string | null
          industry?: string | null
          name?: string | null
          name_normalized?: string | null
          status?: Database["public"]["Enums"]["org_status"] | null
          total_positions?: never
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      admin_pipeline_health: {
        Row: {
          delivered: number | null
          hired: number | null
          organization_name: string | null
          pending: number | null
          position_id: string | null
          shortlisted: number | null
          title: string | null
          total_matches: number | null
        }
        Relationships: []
      }
      admin_positions_view: {
        Row: {
          approved_at: string | null
          closed_at: string | null
          compensation: Json | null
          created_at: string | null
          created_by: string | null
          dealbreakers: Json | null
          department: string | null
          description: string | null
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          id: string | null
          location: string | null
          organization_id: string | null
          organization_name: string | null
          pending_reviews: number | null
          preferred_requirements: Json | null
          published_at: string | null
          requirements: Json | null
          seniority: string | null
          status: Database["public"]["Enums"]["position_status"] | null
          submitted_at: string | null
          title: string | null
          total_applications: number | null
          updated_at: string | null
          visibility: Database["public"]["Enums"]["position_visibility"] | null
          work_authorization: Json | null
          work_model: Database["public"]["Enums"]["work_model"] | null
        }
        Relationships: [
          {
            foreignKeyName: "positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      admin_work_inbox: {
        Row: {
          admin_status:
            | Database["public"]["Enums"]["admin_review_status"]
            | null
          application_id: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          organization_id: string | null
          organization_name: string | null
          position_id: string | null
          position_title: string | null
          stage: Database["public"]["Enums"]["match_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_matches_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "candidate_matches_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "v_source_attribution"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "candidate_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_evidence_client: {
        Row: {
          candidate_match_id: string | null
          confidence: number | null
          factual_quote: string | null
          id: string | null
          interpretation: string | null
          last_reviewed_at: string | null
          match_type: string | null
          organization_id: string | null
          result: string | null
          rubric_criterion_key: string | null
          rubric_dimension_key: string | null
          source_kind: string | null
          source_location: Json | null
          source_ref: string | null
          validation_need: string | null
        }
        Insert: {
          candidate_match_id?: string | null
          confidence?: number | null
          factual_quote?: string | null
          id?: string | null
          interpretation?: string | null
          last_reviewed_at?: string | null
          match_type?: string | null
          organization_id?: string | null
          result?: string | null
          rubric_criterion_key?: string | null
          rubric_dimension_key?: string | null
          source_kind?: string | null
          source_location?: Json | null
          source_ref?: string | null
          validation_need?: string | null
        }
        Update: {
          candidate_match_id?: string | null
          confidence?: number | null
          factual_quote?: string | null
          id?: string | null
          interpretation?: string | null
          last_reviewed_at?: string | null
          match_type?: string | null
          organization_id?: string | null
          result?: string | null
          rubric_criterion_key?: string | null
          rubric_dimension_key?: string | null
          source_kind?: string | null
          source_location?: Json | null
          source_ref?: string | null
          validation_need?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_evidence_items_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evidence_items_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "admin_work_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evidence_items_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "candidate_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evidence_items_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_candidate_matches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evidence_items_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_kanban_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evidence_items_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "client_visible_candidates"
            referencedColumns: ["candidate_match_id"]
          },
          {
            foreignKeyName: "candidate_evidence_items_candidate_match_id_fkey"
            columns: ["candidate_match_id"]
            isOneToOne: false
            referencedRelation: "v_source_attribution"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "candidate_evidence_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evidence_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_evidence_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      candidate_messages_view: {
        Row: {
          body: string | null
          created_at: string | null
          id: string | null
          read_at: string | null
          recipient_context: Json | null
          sender_user_id: string | null
          thread_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string | null
          read_at?: string | null
          recipient_context?: Json | null
          sender_user_id?: string | null
          thread_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string | null
          read_at?: string | null
          recipient_context?: Json | null
          sender_user_id?: string | null
          thread_id?: string | null
        }
        Relationships: []
      }
      candidate_my_applications: {
        Row: {
          application_id: string | null
          applied_at: string | null
          candidate_status: string | null
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          location: string | null
          organization_name: string | null
          position_id: string | null
          status: Database["public"]["Enums"]["application_status"] | null
          title: string | null
          withdrawn_at: string | null
          work_model: Database["public"]["Enums"]["work_model"] | null
        }
        Relationships: []
      }
      candidate_profile_view: {
        Row: {
          availability: Json | null
          compensation_preferences: Json | null
          consent: Json | null
          created_at: string | null
          current_cv_file_id: string | null
          education: Json | null
          email: string | null
          experience: Json | null
          full_name: string | null
          headline: string | null
          id: string | null
          languages: Json | null
          location: string | null
          phone: string | null
          skills: Json | null
          updated_at: string | null
          user_id: string | null
          work_authorization: Json | null
        }
        Insert: {
          availability?: Json | null
          compensation_preferences?: Json | null
          consent?: Json | null
          created_at?: string | null
          current_cv_file_id?: string | null
          education?: Json | null
          email?: string | null
          experience?: Json | null
          full_name?: string | null
          headline?: string | null
          id?: string | null
          languages?: Json | null
          location?: string | null
          phone?: string | null
          skills?: Json | null
          updated_at?: string | null
          user_id?: string | null
          work_authorization?: Json | null
        }
        Update: {
          availability?: Json | null
          compensation_preferences?: Json | null
          consent?: Json | null
          created_at?: string | null
          current_cv_file_id?: string | null
          education?: Json | null
          email?: string | null
          experience?: Json | null
          full_name?: string | null
          headline?: string | null
          id?: string | null
          languages?: Json | null
          location?: string | null
          phone?: string | null
          skills?: Json | null
          updated_at?: string | null
          user_id?: string | null
          work_authorization?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_profiles_cv_fk"
            columns: ["current_cv_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      client_candidate_matches_view: {
        Row: {
          delivered_at: string | null
          full_name: string | null
          headline: string | null
          id: string | null
          latest_score: number | null
          location: string | null
          organization_id: string | null
          position_id: string | null
          position_title: string | null
          stage: Database["public"]["Enums"]["match_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      client_dashboard_kpis: {
        Row: {
          hires: number | null
          in_interview: number | null
          offers: number | null
          organization_id: string | null
          shortlisted: number | null
          visible_matches: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      client_kanban_view: {
        Row: {
          full_name: string | null
          headline: string | null
          id: string | null
          organization_id: string | null
          position_id: string | null
          stage: Database["public"]["Enums"]["match_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      client_messages_view: {
        Row: {
          body: string | null
          created_at: string | null
          id: string | null
          read_at: string | null
          recipient_context: Json | null
          sender_user_id: string | null
          thread_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string | null
          read_at?: string | null
          recipient_context?: Json | null
          sender_user_id?: string | null
          thread_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string | null
          read_at?: string | null
          recipient_context?: Json | null
          sender_user_id?: string | null
          thread_id?: string | null
        }
        Relationships: []
      }
      client_positions_view: {
        Row: {
          approved_at: string | null
          closed_at: string | null
          compensation: Json | null
          created_at: string | null
          created_by: string | null
          dealbreakers: Json | null
          department: string | null
          description: string | null
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          id: string | null
          location: string | null
          organization_id: string | null
          organization_name: string | null
          preferred_requirements: Json | null
          published_at: string | null
          requirements: Json | null
          seniority: string | null
          status: Database["public"]["Enums"]["position_status"] | null
          submitted_at: string | null
          title: string | null
          updated_at: string | null
          visibility: Database["public"]["Enums"]["position_visibility"] | null
          visible_matches: number | null
          work_authorization: Json | null
          work_model: Database["public"]["Enums"]["work_model"] | null
        }
        Relationships: [
          {
            foreignKeyName: "positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      client_visible_candidates: {
        Row: {
          admin_status:
            | Database["public"]["Enums"]["admin_review_status"]
            | null
          application_id: string | null
          applied_cap: number | null
          approved_score_run_id: string | null
          blueprint_version: string | null
          candidate_match_id: string | null
          candidate_profile_id: string | null
          canonical_state:
            | Database["public"]["Enums"]["canonical_scoring_state"]
            | null
          client_visibility:
            | Database["public"]["Enums"]["client_visibility"]
            | null
          contradiction_status: string | null
          delivered_at: string | null
          engine_version: string | null
          evidence: Json | null
          final_score: number | null
          match_created_at: string | null
          match_updated_at: string | null
          organization_id: string | null
          position_id: string | null
          raw_score: number | null
          rubric_version_id: string | null
          scored_at: string | null
          stage: Database["public"]["Enums"]["match_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_matches_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "candidate_matches_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "v_source_attribution"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "candidate_matches_approved_score_run_id_fkey"
            columns: ["approved_score_run_id"]
            isOneToOne: false
            referencedRelation: "score_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_matches_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_runs_rubric_version_id_fkey"
            columns: ["rubric_version_id"]
            isOneToOne: false
            referencedRelation: "rubric_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      v_outreach_campaigns: {
        Row: {
          bounced: number | null
          channel: Database["public"]["Enums"]["outreach_channel"] | null
          created_at: string | null
          delivered: number | null
          ended_at: string | null
          failed: number | null
          id: string | null
          name: string | null
          opted_out: number | null
          organization_id: string | null
          owner_user_id: string | null
          position_id: string | null
          replied: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["outreach_campaign_status"] | null
          target_count: number | null
          touches_sent: number | null
          touches_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "outreach_campaigns_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "outreach_campaigns_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "outreach_campaigns_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      v_outreach_channel_tiles: {
        Row: {
          active_campaigns: number | null
          bounced: number | null
          channel: Database["public"]["Enums"]["outreach_channel"] | null
          delivered: number | null
          engaged_candidates: number | null
          failed: number | null
          opened: number | null
          opted_out: number | null
          organization_id: string | null
          replied: number | null
          reply_future: number | null
          reply_interested: number | null
          reply_not_interested: number | null
          reply_ooo: number | null
          reply_referral: number | null
          reply_unsub: number | null
          total_campaigns: number | null
          touches_sent: number | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      v_portfolio_rollup: {
        Row: {
          business_unit: string | null
          candidates_in_flight: number | null
          filled_positions: number | null
          hires: number | null
          open_positions: number | null
          organization_id: string | null
          organization_name: string | null
          portfolio_org_id: string | null
          region: string | null
        }
        Relationships: []
      }
      v_source_attribution: {
        Row: {
          application_id: string | null
          applied_at: string | null
          candidate_profile_id: string | null
          channel: string | null
          hire_status: Database["public"]["Enums"]["hire_status"] | null
          hired_at: string | null
          kind: string | null
          match_id: string | null
          organization_id: string | null
          outreach_replied_at: string | null
          outreach_sent_at: string | null
          position_id: string | null
          source_campaign: string | null
          source_cost_cents: number | null
          stage: Database["public"]["Enums"]["match_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "applications_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "applications_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      v_source_attribution_rollup: {
        Row: {
          applications: number | null
          channel: string | null
          first_applied_at: string | null
          hired: number | null
          interviewed: number | null
          kind: string | null
          last_applied_at: string | null
          offered: number | null
          organization_id: string | null
          outreach_replied: number | null
          outreach_sent: number | null
          shortlisted: number | null
          total_cost_cents: number | null
        }
        Relationships: [
          {
            foreignKeyName: "positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      v_time_to_hire: {
        Row: {
          applied_at: string | null
          candidate_name: string | null
          candidate_profile_id: string | null
          close_reason: Database["public"]["Enums"]["hire_close_reason"] | null
          days_offer_to_accept: number | null
          days_to_hire: number | null
          hire_record_id: string | null
          hired_at: string | null
          offer_accepted_at: string | null
          offer_sent_at: string | null
          organization_id: string | null
          owner_user_id: string | null
          position_id: string | null
          position_title: string | null
          status: Database["public"]["Enums"]["hire_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "hire_records_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hire_records_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hire_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "admin_clients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hire_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hire_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_rollup"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "hire_records_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_pipeline_health"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "hire_records_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "admin_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hire_records_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "candidate_my_applications"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "hire_records_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "client_positions_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hire_records_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      hard_delete_candidate_match: {
        Args: { _actor_user_id: string; _match_id: string; _reason?: string }
        Returns: Json
      }
      has_org_role: {
        Args: {
          _org: string
          _roles: Database["public"]["Enums"]["membership_role"][]
          _user: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_user: { Args: { _user: string }; Returns: boolean }
      is_org_admin: { Args: { _org: string; _user: string }; Returns: boolean }
      is_org_editor: { Args: { _org: string; _user: string }; Returns: boolean }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
      is_org_viewer: { Args: { _org: string; _user: string }; Returns: boolean }
      is_owning_candidate: {
        Args: { _cp: string; _user: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user: string }; Returns: boolean }
      is_platform_staff: { Args: { _user: string }; Returns: boolean }
      score_band: {
        Args: { _score: number }
        Returns: Database["public"]["Enums"]["score_band"]
      }
      scoring_readiness: { Args: { _match_id: string }; Returns: Json }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      admin_review_status: "pending" | "approved" | "rejected" | "on_hold"
      answer_type:
        | "text"
        | "long_text"
        | "single_choice"
        | "multi_choice"
        | "boolean"
        | "number"
        | "date"
      app_role: "admin" | "client" | "candidate"
      application_status:
        | "submitted"
        | "processing"
        | "ready_for_review"
        | "withdrawn"
        | "rejected"
        | "archived"
      canonical_scoring_state:
        | "ingestion"
        | "evidence_extraction"
        | "provisional_scoring"
        | "human_review"
        | "approved"
        | "published_to_client"
        | "returned_for_correction"
        | "superseded"
        | "failed"
      client_decision_type:
        | "shortlist"
        | "request_interview"
        | "request_information"
        | "not_moving_forward"
        | "hire"
        | "offer"
      client_visibility: "hidden" | "visible" | "archived"
      delivery_channel: "in_app" | "email" | "sms"
      delivery_status:
        | "created"
        | "queued"
        | "provider_accepted"
        | "delivered"
        | "failed"
        | "bounced"
        | "suppressed"
      eligibility_status:
        | "not_evaluated"
        | "eligible"
        | "not_eligible"
        | "needs_validation"
        | "excepted"
      employment_type:
        | "full_time"
        | "part_time"
        | "contract"
        | "temporary"
        | "internship"
      event_type:
        | "intake_submitted"
        | "clarification_requested"
        | "position_approved"
        | "position_activated"
        | "position_paused"
        | "application_received"
        | "candidate_processing_completed"
        | "candidate_ready_for_admin_review"
        | "candidate_published"
        | "client_shortlisted"
        | "interview_requested"
        | "interview_scheduled"
        | "client_feedback_submitted"
        | "candidate_hired"
        | "position_filled"
        | "position_closed"
        | "message_sent"
      file_status: "uploading" | "ready" | "failed" | "deleted"
      hire_close_reason:
        | "candidate_declined"
        | "counter_offer"
        | "other_offer_accepted"
        | "compensation_mismatch"
        | "role_paused"
        | "budget"
        | "timing"
        | "culture_fit"
        | "background_check"
        | "position_cancelled"
        | "other"
      hire_status:
        | "offer_drafted"
        | "offer_sent"
        | "offer_accepted"
        | "offer_declined"
        | "hire_confirmed"
        | "closed_lost"
      integrity_status:
        | "ok"
        | "missing_required"
        | "contradictions"
        | "manual_review"
      interview_status:
        | "requested"
        | "scheduling"
        | "scheduled"
        | "completed"
        | "cancelled"
      job_status: "queued" | "running" | "completed" | "failed" | "cancelled"
      match_stage:
        | "new"
        | "reviewing"
        | "delivered"
        | "shortlisted"
        | "interview_process"
        | "offer"
        | "hired"
        | "not_moving_forward"
        | "archived"
      membership_role:
        | "platform_admin"
        | "operations"
        | "client_admin"
        | "client_editor"
        | "client_viewer"
        | "candidate"
      membership_status: "active" | "invited" | "suspended" | "removed"
      migration_row_status:
        | "pending"
        | "imported"
        | "verified"
        | "superseded"
        | "rejected"
        | "skipped"
      migration_run_status:
        | "planned"
        | "running"
        | "completed"
        | "failed"
        | "aborted"
      migration_validation_status: "not_run" | "passed" | "warned" | "failed"
      notification_audience: "admin" | "client" | "candidate"
      org_status: "prospect" | "active" | "paused" | "archived"
      outreach_campaign_status:
        | "draft"
        | "active"
        | "paused"
        | "completed"
        | "archived"
      outreach_channel:
        | "email"
        | "linkedin"
        | "phone"
        | "sms"
        | "referral"
        | "event"
        | "other"
      outreach_engagement_state:
        | "cold"
        | "contacted"
        | "engaged"
        | "warm"
        | "hot"
        | "opted_out"
      outreach_reply_category:
        | "interested"
        | "not_interested"
        | "future"
        | "referral"
        | "out_of_office"
        | "unsubscribe"
        | "other"
      outreach_touch_state:
        | "queued"
        | "sent"
        | "delivered"
        | "bounced"
        | "opened"
        | "replied"
        | "opted_out"
        | "failed"
      position_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "needs_clarification"
        | "approved"
        | "active"
        | "paused"
        | "filled"
        | "closed"
        | "archived"
      position_visibility: "public" | "private" | "internal"
      processing_state:
        | "queued"
        | "parsing"
        | "ocr_required"
        | "parsed"
        | "enriching"
        | "ready_to_score"
        | "scoring"
        | "scored"
        | "manual_review_required"
        | "provider_blocked"
        | "failed"
      profile_status: "active" | "suspended" | "deleted"
      recommendation_status:
        | "pending"
        | "shortlist"
        | "review"
        | "hold_for_validation"
        | "do_not_recommend"
      role_memory_kind:
        | "brief"
        | "rationale"
        | "handoff"
        | "candidate_reasoning"
        | "decision"
        | "risk"
        | "next_step"
      rubric_version_status:
        | "draft"
        | "pending_approval"
        | "pending_client_approval"
        | "approved"
        | "active"
        | "superseded"
      score_band:
        | "exceptional"
        | "top"
        | "strong"
        | "consider"
        | "not_recommended"
        | "unscored"
      score_decision_type:
        | "approve"
        | "override"
        | "reject"
        | "request_recompute"
      score_status: "queued" | "running" | "completed" | "failed" | "cancelled"
      shortlist_share_mode: "review" | "presentation" | "compare"
      silver_consent: "granted" | "pending" | "declined" | "withdrawn"
      silver_reason:
        | "role_filled"
        | "timing"
        | "comp_gap"
        | "level_mismatch"
        | "geo"
        | "better_fit_selected"
        | "skills_gap"
        | "other"
      source_kind:
        | "inbound"
        | "sourced"
        | "referral"
        | "agency"
        | "rehire"
        | "event"
        | "other"
      task_priority: "low" | "normal" | "high" | "urgent"
      task_status: "open" | "in_progress" | "done" | "cancelled"
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
      admin_review_status: ["pending", "approved", "rejected", "on_hold"],
      answer_type: [
        "text",
        "long_text",
        "single_choice",
        "multi_choice",
        "boolean",
        "number",
        "date",
      ],
      app_role: ["admin", "client", "candidate"],
      application_status: [
        "submitted",
        "processing",
        "ready_for_review",
        "withdrawn",
        "rejected",
        "archived",
      ],
      canonical_scoring_state: [
        "ingestion",
        "evidence_extraction",
        "provisional_scoring",
        "human_review",
        "approved",
        "published_to_client",
        "returned_for_correction",
        "superseded",
        "failed",
      ],
      client_decision_type: [
        "shortlist",
        "request_interview",
        "request_information",
        "not_moving_forward",
        "hire",
        "offer",
      ],
      client_visibility: ["hidden", "visible", "archived"],
      delivery_channel: ["in_app", "email", "sms"],
      delivery_status: [
        "created",
        "queued",
        "provider_accepted",
        "delivered",
        "failed",
        "bounced",
        "suppressed",
      ],
      eligibility_status: [
        "not_evaluated",
        "eligible",
        "not_eligible",
        "needs_validation",
        "excepted",
      ],
      employment_type: [
        "full_time",
        "part_time",
        "contract",
        "temporary",
        "internship",
      ],
      event_type: [
        "intake_submitted",
        "clarification_requested",
        "position_approved",
        "position_activated",
        "position_paused",
        "application_received",
        "candidate_processing_completed",
        "candidate_ready_for_admin_review",
        "candidate_published",
        "client_shortlisted",
        "interview_requested",
        "interview_scheduled",
        "client_feedback_submitted",
        "candidate_hired",
        "position_filled",
        "position_closed",
        "message_sent",
      ],
      file_status: ["uploading", "ready", "failed", "deleted"],
      hire_close_reason: [
        "candidate_declined",
        "counter_offer",
        "other_offer_accepted",
        "compensation_mismatch",
        "role_paused",
        "budget",
        "timing",
        "culture_fit",
        "background_check",
        "position_cancelled",
        "other",
      ],
      hire_status: [
        "offer_drafted",
        "offer_sent",
        "offer_accepted",
        "offer_declined",
        "hire_confirmed",
        "closed_lost",
      ],
      integrity_status: [
        "ok",
        "missing_required",
        "contradictions",
        "manual_review",
      ],
      interview_status: [
        "requested",
        "scheduling",
        "scheduled",
        "completed",
        "cancelled",
      ],
      job_status: ["queued", "running", "completed", "failed", "cancelled"],
      match_stage: [
        "new",
        "reviewing",
        "delivered",
        "shortlisted",
        "interview_process",
        "offer",
        "hired",
        "not_moving_forward",
        "archived",
      ],
      membership_role: [
        "platform_admin",
        "operations",
        "client_admin",
        "client_editor",
        "client_viewer",
        "candidate",
      ],
      membership_status: ["active", "invited", "suspended", "removed"],
      migration_row_status: [
        "pending",
        "imported",
        "verified",
        "superseded",
        "rejected",
        "skipped",
      ],
      migration_run_status: [
        "planned",
        "running",
        "completed",
        "failed",
        "aborted",
      ],
      migration_validation_status: ["not_run", "passed", "warned", "failed"],
      notification_audience: ["admin", "client", "candidate"],
      org_status: ["prospect", "active", "paused", "archived"],
      outreach_campaign_status: [
        "draft",
        "active",
        "paused",
        "completed",
        "archived",
      ],
      outreach_channel: [
        "email",
        "linkedin",
        "phone",
        "sms",
        "referral",
        "event",
        "other",
      ],
      outreach_engagement_state: [
        "cold",
        "contacted",
        "engaged",
        "warm",
        "hot",
        "opted_out",
      ],
      outreach_reply_category: [
        "interested",
        "not_interested",
        "future",
        "referral",
        "out_of_office",
        "unsubscribe",
        "other",
      ],
      outreach_touch_state: [
        "queued",
        "sent",
        "delivered",
        "bounced",
        "opened",
        "replied",
        "opted_out",
        "failed",
      ],
      position_status: [
        "draft",
        "submitted",
        "under_review",
        "needs_clarification",
        "approved",
        "active",
        "paused",
        "filled",
        "closed",
        "archived",
      ],
      position_visibility: ["public", "private", "internal"],
      processing_state: [
        "queued",
        "parsing",
        "ocr_required",
        "parsed",
        "enriching",
        "ready_to_score",
        "scoring",
        "scored",
        "manual_review_required",
        "provider_blocked",
        "failed",
      ],
      profile_status: ["active", "suspended", "deleted"],
      recommendation_status: [
        "pending",
        "shortlist",
        "review",
        "hold_for_validation",
        "do_not_recommend",
      ],
      role_memory_kind: [
        "brief",
        "rationale",
        "handoff",
        "candidate_reasoning",
        "decision",
        "risk",
        "next_step",
      ],
      rubric_version_status: [
        "draft",
        "pending_approval",
        "pending_client_approval",
        "approved",
        "active",
        "superseded",
      ],
      score_band: [
        "exceptional",
        "top",
        "strong",
        "consider",
        "not_recommended",
        "unscored",
      ],
      score_decision_type: [
        "approve",
        "override",
        "reject",
        "request_recompute",
      ],
      score_status: ["queued", "running", "completed", "failed", "cancelled"],
      shortlist_share_mode: ["review", "presentation", "compare"],
      silver_consent: ["granted", "pending", "declined", "withdrawn"],
      silver_reason: [
        "role_filled",
        "timing",
        "comp_gap",
        "level_mismatch",
        "geo",
        "better_fit_selected",
        "skills_gap",
        "other",
      ],
      source_kind: [
        "inbound",
        "sourced",
        "referral",
        "agency",
        "rehire",
        "event",
        "other",
      ],
      task_priority: ["low", "normal", "high", "urgent"],
      task_status: ["open", "in_progress", "done", "cancelled"],
      work_model: ["remote", "hybrid", "onsite"],
    },
  },
} as const
