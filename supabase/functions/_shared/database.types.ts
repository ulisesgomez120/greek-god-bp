// ============================================================================
// DATABASE TYPES FOR SUPABASE EDGE FUNCTIONS
// ============================================================================
// Auto-generated types based on the database schema

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string;
          avatar_url: string | null;
          height_cm: number | null;
          weight_kg: number | null;
          birth_date: string | null;
          gender: "male" | "female" | "other" | "prefer_not_to_say" | null;
          experience_level: "untrained" | "beginner" | "early_intermediate" | "intermediate" | "advanced";
          fitness_goals: string[] | null;
          available_equipment: string[] | null;
          privacy_settings: Json | null;
          role: "user" | "premium" | "coach" | "admin" | null;
          stripe_customer_id: string | null;
          onboarding_completed: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name: string;
          avatar_url?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          birth_date?: string | null;
          gender?: "male" | "female" | "other" | "prefer_not_to_say" | null;
          experience_level?: "untrained" | "beginner" | "early_intermediate" | "intermediate" | "advanced";
          fitness_goals?: string[] | null;
          available_equipment?: string[] | null;
          privacy_settings?: Json | null;
          role?: "user" | "premium" | "coach" | "admin" | null;
          stripe_customer_id?: string | null;
          onboarding_completed?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string;
          avatar_url?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          birth_date?: string | null;
          gender?: "male" | "female" | "other" | "prefer_not_to_say" | null;
          experience_level?: "untrained" | "beginner" | "early_intermediate" | "intermediate" | "advanced";
          fitness_goals?: string[] | null;
          available_equipment?: string[] | null;
          privacy_settings?: Json | null;
          role?: "user" | "premium" | "coach" | "admin" | null;
          stripe_customer_id?: string | null;
          onboarding_completed?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string | null;
          session_id: string | null;
          name: string;
          started_at: string;
          completed_at: string | null;
          duration_minutes: number | null;
          total_volume_kg: number | null;
          average_rpe: number | null;
          notes: string | null;
          sync_status: "synced" | "pending" | "conflict" | null;
          offline_created: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id?: string | null;
          session_id?: string | null;
          name: string;
          started_at: string;
          completed_at?: string | null;
          duration_minutes?: number | null;
          total_volume_kg?: number | null;
          average_rpe?: number | null;
          notes?: string | null;
          sync_status?: "synced" | "pending" | "conflict" | null;
          offline_created?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_id?: string | null;
          session_id?: string | null;
          name?: string;
          started_at?: string;
          completed_at?: string | null;
          duration_minutes?: number | null;
          total_volume_kg?: number | null;
          average_rpe?: number | null;
          notes?: string | null;
          sync_status?: "synced" | "pending" | "conflict" | null;
          offline_created?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      exercise_sets: {
        Row: {
          id: string;
          session_id: string;
          exercise_id: string;
          planned_exercise_id: string | null;
          set_number: number;
          weight_kg: number | null;
          reps: number | null;
          rpe: number | null;
          is_warmup: boolean | null;
          is_failure: boolean | null;
          rest_seconds: number | null;
          notes: string | null;
          form_rating: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          exercise_id: string;
          planned_exercise_id?: string | null;
          set_number: number;
          weight_kg?: number | null;
          reps?: number | null;
          rpe?: number | null;
          is_warmup?: boolean | null;
          is_failure?: boolean | null;
          rest_seconds?: number | null;
          notes?: string | null;
          form_rating?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          exercise_id?: string;
          planned_exercise_id?: string | null;
          set_number?: number;
          weight_kg?: number | null;
          reps?: number | null;
          rpe?: number | null;
          is_warmup?: boolean | null;
          is_failure?: boolean | null;
          rest_seconds?: number | null;
          notes?: string | null;
          form_rating?: number | null;
          created_at?: string;
        };
      };
      ai_usage_tracking: {
        Row: {
          id: string;
          user_id: string;
          query_type: string;
          query_text: string | null;
          response_text: string | null;
          tokens_used: number;
          estimated_cost: number;
          model_used: string;
          response_time_ms: number | null;
          user_rating: number | null;
          user_feedback: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          query_type: string;
          query_text?: string | null;
          response_text?: string | null;
          tokens_used: number;
          estimated_cost: number;
          model_used: string;
          response_time_ms?: number | null;
          user_rating?: number | null;
          user_feedback?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          query_type?: string;
          query_text?: string | null;
          response_text?: string | null;
          tokens_used?: number;
          estimated_cost?: number;
          model_used?: string;
          response_time_ms?: number | null;
          user_rating?: number | null;
          user_feedback?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      user_has_feature_access: {
        Args: {
          user_uuid: string;
          required_features: string[];
        };
        Returns: boolean;
      };
      get_user_subscription_status: {
        Args: {
          user_uuid: string;
        };
        Returns: string;
      };
      check_ai_budget: {
        Args: {
          user_uuid: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      experience_level_enum: "untrained" | "beginner" | "early_intermediate" | "intermediate" | "advanced";
      gender_enum: "male" | "female" | "other" | "prefer_not_to_say";
      sync_status_enum: "synced" | "pending" | "conflict";
      user_role_enum: "user" | "premium" | "coach" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
