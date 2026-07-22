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
      application_answers: {
        Row: {
          answer: Json
          application_id: string
          created_at: string
          id: string
          question_id: string
          updated_at: string
        }
        Insert: {
          answer: Json
          application_id: string
          created_at?: string
          id?: string
          question_id: string
          updated_at?: string
        }
        Update: {
          answer?: Json
          application_id?: string
          created_at?: string
          id?: string
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
          id: string
          position_id: string
          source: string | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          withdrawn_at: string | null
        }
        Insert: {
          applied_at?: string
          candidate_profile_id: string
          created_at?: string
          id?: string
          position_id: string
          source?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          withdrawn_at?: string | null
        }
        Update: {
          applied_at?: string
          candidate_profile_id?: string
          created_at?: string
          id?: string
          position_id?: string
          source?: string | null
          status?: Database["public"]["Enums"]["application_status"]
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
        ]
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
      candidate_matches: {
        Row: {
          admin_status: Database["public"]["Enums"]["admin_review_status"]
          application_id: string
          approved_score_run_id: string | null
          candidate_profile_id: string
          client_visibility: Database["public"]["Enums"]["client_visibility"]
          created_at: string
          current_score_run_id: string | null
          delivered_at: string | null
          id: string
          last_processing_trace_id: string | null
          organization_id: string
          position_id: string
          processing_error_code: string | null
          processing_error_message: string | null
          processing_state: Database["public"]["Enums"]["processing_state"]
          processing_updated_at: string
          stage: Database["public"]["Enums"]["match_stage"]
          updated_at: string
        }
        Insert: {
          admin_status?: Database["public"]["Enums"]["admin_review_status"]
          application_id: string
          approved_score_run_id?: string | null
          candidate_profile_id: string
          client_visibility?: Database["public"]["Enums"]["client_visibility"]
          created_at?: string
          current_score_run_id?: string | null
          delivered_at?: string | null
          id?: string
          last_processing_trace_id?: string | null
          organization_id: string
          position_id: string
          processing_error_code?: string | null
          processing_error_message?: string | null
          processing_state?: Database["public"]["Enums"]["processing_state"]
          processing_updated_at?: string
          stage?: Database["public"]["Enums"]["match_stage"]
          updated_at?: string
        }
        Update: {
          admin_status?: Database["public"]["Enums"]["admin_review_status"]
          application_id?: string
          approved_score_run_id?: string | null
          candidate_profile_id?: string
          client_visibility?: Database["public"]["Enums"]["client_visibility"]
          created_at?: string
          current_score_run_id?: string | null
          delivered_at?: string | null
          id?: string
          last_processing_trace_id?: string | null
          organization_id?: string
          position_id?: string
          processing_error_code?: string | null
          processing_error_message?: string | null
          processing_state?: Database["public"]["Enums"]["processing_state"]
          processing_updated_at?: string
          stage?: Database["public"]["Enums"]["match_stage"]
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
          compensation_preferences: Json
          consent: Json
          created_at: string
          current_cv_file_id: string | null
          education: Json
          email: string
          experience: Json
          full_name: string
          headline: string | null
          id: string
          languages: Json
          location: string | null
          phone: string | null
          skills: Json
          updated_at: string
          user_id: string | null
          work_authorization: Json
        }
        Insert: {
          availability?: Json
          compensation_preferences?: Json
          consent?: Json
          created_at?: string
          current_cv_file_id?: string | null
          education?: Json
          email: string
          experience?: Json
          full_name: string
          headline?: string | null
          id?: string
          languages?: Json
          location?: string | null
          phone?: string | null
          skills?: Json
          updated_at?: string
          user_id?: string | null
          work_authorization?: Json
        }
        Update: {
          availability?: Json
          compensation_preferences?: Json
          consent?: Json
          created_at?: string
          current_cv_file_id?: string | null
          education?: Json
          email?: string
          experience?: Json
          full_name?: string
          headline?: string | null
          id?: string
          languages?: Json
          location?: string | null
          phone?: string | null
          skills?: Json
          updated_at?: string
          user_id?: string | null
          work_authorization?: Json
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
      client_decisions: {
        Row: {
          actor_user_id: string | null
          candidate_match_id: string
          created_at: string
          decision: Database["public"]["Enums"]["client_decision_type"]
          feedback: string | null
          id: string
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
      files: {
        Row: {
          candidate_profile_id: string | null
          checksum: string | null
          created_at: string
          extracted_text: string | null
          extraction_attempts: number
          extraction_completed_at: string | null
          file_status: Database["public"]["Enums"]["file_status"]
          filename: string
          id: string
          mime_type: string | null
          ocr_used: boolean
          owner_user_id: string | null
          size: number | null
          storage_bucket: string
          storage_path: string
        }
        Insert: {
          candidate_profile_id?: string | null
          checksum?: string | null
          created_at?: string
          extracted_text?: string | null
          extraction_attempts?: number
          extraction_completed_at?: string | null
          file_status?: Database["public"]["Enums"]["file_status"]
          filename: string
          id?: string
          mime_type?: string | null
          ocr_used?: boolean
          owner_user_id?: string | null
          size?: number | null
          storage_bucket: string
          storage_path: string
        }
        Update: {
          candidate_profile_id?: string | null
          checksum?: string | null
          created_at?: string
          extracted_text?: string | null
          extraction_attempts?: number
          extraction_completed_at?: string | null
          file_status?: Database["public"]["Enums"]["file_status"]
          filename?: string
          id?: string
          mime_type?: string | null
          ocr_used?: boolean
          owner_user_id?: string | null
          size?: number | null
          storage_bucket?: string
          storage_path?: string
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
      interviews: {
        Row: {
          cancelled_at: string | null
          candidate_match_id: string
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          requested_at: string
          scheduled_at: string | null
          status: Database["public"]["Enums"]["interview_status"]
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          candidate_match_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          requested_at?: string
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          candidate_match_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          requested_at?: string
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          updated_at?: string
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
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["membership_role"]
          status: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["membership_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          status?: Database["public"]["Enums"]["membership_status"]
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
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_context: Json
          sender_user_id: string | null
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_context?: Json
          sender_user_id?: string | null
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_context?: Json
          sender_user_id?: string | null
          thread_id?: string
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
          link_path: string | null
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
          link_path?: string | null
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
          link_path?: string | null
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
        ]
      }
      organizations: {
        Row: {
          created_at: string
          domain: string | null
          headquarters: string | null
          id: string
          industry: string | null
          name: string
          name_normalized: string | null
          status: Database["public"]["Enums"]["org_status"]
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          domain?: string | null
          headquarters?: string | null
          id?: string
          industry?: string | null
          name: string
          name_normalized?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          domain?: string | null
          headquarters?: string | null
          id?: string
          industry?: string | null
          name?: string
          name_normalized?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      positions: {
        Row: {
          approved_at: string | null
          closed_at: string | null
          compensation: Json
          created_at: string
          created_by: string | null
          dealbreakers: Json
          department: string | null
          description: string | null
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          id: string
          location: string | null
          organization_id: string
          preferred_requirements: Json
          published_at: string | null
          requirements: Json
          seniority: string | null
          status: Database["public"]["Enums"]["position_status"]
          submitted_at: string | null
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["position_visibility"]
          work_authorization: Json
          work_model: Database["public"]["Enums"]["work_model"] | null
        }
        Insert: {
          approved_at?: string | null
          closed_at?: string | null
          compensation?: Json
          created_at?: string
          created_by?: string | null
          dealbreakers?: Json
          department?: string | null
          description?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          id?: string
          location?: string | null
          organization_id: string
          preferred_requirements?: Json
          published_at?: string | null
          requirements?: Json
          seniority?: string | null
          status?: Database["public"]["Enums"]["position_status"]
          submitted_at?: string | null
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["position_visibility"]
          work_authorization?: Json
          work_model?: Database["public"]["Enums"]["work_model"] | null
        }
        Update: {
          approved_at?: string | null
          closed_at?: string | null
          compensation?: Json
          created_at?: string
          created_by?: string | null
          dealbreakers?: Json
          department?: string | null
          description?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          id?: string
          location?: string | null
          organization_id?: string
          preferred_requirements?: Json
          published_at?: string | null
          requirements?: Json
          seniority?: string | null
          status?: Database["public"]["Enums"]["position_status"]
          submitted_at?: string | null
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
          created_at: string
          email: string
          full_name: string | null
          id: string
          locale: string | null
          phone: string | null
          status: Database["public"]["Enums"]["profile_status"]
          timezone: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          locale?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          locale?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
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
          candidate_match_id: string
          completed_at: string | null
          confidence: number | null
          contradiction_status: string | null
          engine_version: string
          error_code: string | null
          evidence: Json
          explanation: string | null
          fit_label: string | null
          id: string
          input_hash: string | null
          must_have_coverage: number | null
          position_id: string
          preferred_coverage: number | null
          requirement_coverage: Json
          result: Json
          score: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["score_status"]
          trace_id: string | null
        }
        Insert: {
          candidate_match_id: string
          completed_at?: string | null
          confidence?: number | null
          contradiction_status?: string | null
          engine_version: string
          error_code?: string | null
          evidence?: Json
          explanation?: string | null
          fit_label?: string | null
          id?: string
          input_hash?: string | null
          must_have_coverage?: number | null
          position_id: string
          preferred_coverage?: number | null
          requirement_coverage?: Json
          result?: Json
          score?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["score_status"]
          trace_id?: string | null
        }
        Update: {
          candidate_match_id?: string
          completed_at?: string | null
          confidence?: number | null
          contradiction_status?: string | null
          engine_version?: string
          error_code?: string | null
          evidence?: Json
          explanation?: string | null
          fit_label?: string | null
          id?: string
          input_hash?: string | null
          must_have_coverage?: number | null
          position_id?: string
          preferred_coverage?: number | null
          requirement_coverage?: Json
          result?: Json
          score?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["score_status"]
          trace_id?: string | null
        }
        Relationships: [
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
        ]
      }
      screening_questions: {
        Row: {
          answer_type: Database["public"]["Enums"]["answer_type"]
          created_at: string
          dealbreaker: boolean
          display_order: number
          id: string
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
        ]
      }
    }
    Functions: {
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
      is_platform_staff: { Args: { _user: string }; Returns: boolean }
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
      client_decision_type:
        | "shortlist"
        | "request_interview"
        | "request_information"
        | "not_moving_forward"
        | "hire"
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
        | "application_received"
        | "candidate_processing_completed"
        | "candidate_ready_for_admin_review"
        | "candidate_published"
        | "client_shortlisted"
        | "interview_requested"
        | "interview_scheduled"
        | "client_feedback_submitted"
        | "candidate_hired"
        | "position_closed"
        | "message_sent"
      file_status: "uploading" | "ready" | "failed" | "deleted"
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
      notification_audience: "admin" | "client" | "candidate"
      org_status: "prospect" | "active" | "paused" | "archived"
      position_status:
        | "draft"
        | "submitted"
        | "needs_clarification"
        | "approved"
        | "active"
        | "paused"
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
      score_decision_type:
        | "approve"
        | "override"
        | "reject"
        | "request_recompute"
      score_status: "queued" | "running" | "completed" | "failed" | "cancelled"
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
      client_decision_type: [
        "shortlist",
        "request_interview",
        "request_information",
        "not_moving_forward",
        "hire",
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
        "application_received",
        "candidate_processing_completed",
        "candidate_ready_for_admin_review",
        "candidate_published",
        "client_shortlisted",
        "interview_requested",
        "interview_scheduled",
        "client_feedback_submitted",
        "candidate_hired",
        "position_closed",
        "message_sent",
      ],
      file_status: ["uploading", "ready", "failed", "deleted"],
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
      notification_audience: ["admin", "client", "candidate"],
      org_status: ["prospect", "active", "paused", "archived"],
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
      score_decision_type: [
        "approve",
        "override",
        "reject",
        "request_recompute",
      ],
      score_status: ["queued", "running", "completed", "failed", "cancelled"],
      work_model: ["remote", "hybrid", "onsite"],
    },
  },
} as const
