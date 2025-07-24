// ============================================================================
// DATABASE TYPE DEFINITIONS
// ============================================================================
// Generated TypeScript types for Supabase database schema

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string;
          experience_level: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name: string;
          experience_level?: string;
        };
        Update: {
          display_name?: string;
          experience_level?: string;
        };
      };
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          started_at: string;
          completed_at?: string;
          duration_minutes?: number;
          total_volume_kg?: number;
          average_rpe?: number;
          sync_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          name: string;
          started_at: string;
          completed_at?: string;
          duration_minutes?: number;
          total_volume_kg?: number;
          average_rpe?: number;
        };
        Update: {
          name?: string;
          completed_at?: string;
          duration_minutes?: number;
          total_volume_kg?: number;
          average_rpe?: number;
        };
      };
      exercise_sets: {
        Row: {
          id: string;
          session_id: string;
          exercise_id: string;
          set_number: number;
          weight_kg?: number;
          reps: number;
          rpe?: number;
          is_warmup: boolean;
          rest_seconds?: number;
          notes?: string;
          created_at: string;
        };
        Insert: {
          session_id: string;
          exercise_id: string;
          set_number: number;
          weight_kg?: number;
          reps: number;
          rpe?: number;
          is_warmup?: boolean;
          rest_seconds?: number;
          notes?: string;
        };
        Update: {
          weight_kg?: number;
          reps?: number;
          rpe?: number;
          rest_seconds?: number;
          notes?: string;
        };
      };
      exercises: {
        Row: {
          id: string;
          name: string;
          description?: string;
          muscle_groups: string[];
          primary_muscle: string;
          equipment: string[];
          difficulty: number;
          is_compound: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          description?: string;
          muscle_groups: string[];
          primary_muscle: string;
          equipment: string[];
          difficulty?: number;
          is_compound?: boolean;
        };
        Update: {
          name?: string;
          description?: string;
          difficulty?: number;
        };
      };
      ai_usage_tracking: {
        Row: {
          id: string;
          user_id: string;
          query_type: string;
          tokens_used: number;
          estimated_cost: number;
          model_used: string;
          response_time_ms?: number;
          created_at: string;
        };
        Insert: {
          user_id: string;
          query_type: string;
          tokens_used: number;
          estimated_cost: number;
          model_used: string;
          response_time_ms?: number;
        };
        Update: {
          user_rating?: number;
          user_feedback?: string;
        };
      };
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
        Returns: {
          within_budget: boolean;
          remaining_budget: number;
          total_cost: number;
          total_queries: number;
          budget_limit?: number;
        };
      };
    };
  };
}
