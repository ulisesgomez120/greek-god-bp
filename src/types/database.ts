// ============================================================================
// GENERATED TYPESCRIPT TYPES FROM SUPABASE SCHEMA
// ============================================================================
// Auto-generated types based on the database schema
// This file should be regenerated when the database schema changes

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      achievements: {
        Row: {
          id: string;
          name: string;
          description: string;
          category: string;
          criteria: Json;
          points: number;
          rarity: string;
          icon_name: string | null;
          badge_color: string | null;
          is_active: boolean;
          is_hidden: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          category: string;
          criteria: Json;
          points?: number;
          rarity?: string;
          icon_name?: string | null;
          badge_color?: string | null;
          is_active?: boolean;
          is_hidden?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          category?: string;
          criteria?: Json;
          points?: number;
          rarity?: string;
          icon_name?: string | null;
          badge_color?: string | null;
          is_active?: boolean;
          is_hidden?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_coaching_contexts: {
        Row: {
          id: string;
          context_key: string;
          context_name: string;
          description: string | null;
          system_prompt: string;
          suggested_model_id: string | null;
          max_conversation_length: number;
          coaching_style: string | null;
          expertise_areas: string[];
          requires_subscription: boolean;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          context_key: string;
          context_name: string;
          description?: string | null;
          system_prompt: string;
          suggested_model_id?: string | null;
          max_conversation_length?: number;
          coaching_style?: string | null;
          expertise_areas?: string[];
          requires_subscription?: boolean;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          context_key?: string;
          context_name?: string;
          description?: string | null;
          system_prompt?: string;
          suggested_model_id?: string | null;
          max_conversation_length?: number;
          coaching_style?: string | null;
          expertise_areas?: string[];
          requires_subscription?: boolean;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_coaching_contexts_suggested_model_id_fkey";
            columns: ["suggested_model_id"];
            isOneToOne: false;
            referencedRelation: "ai_models";
            referencedColumns: ["id"];
          }
        ];
      };
      ai_conversation_sessions: {
        Row: {
          id: string;
          user_id: string;
          context_id: string | null;
          session_title: string | null;
          session_type: string | null;
          status: string;
          message_count: number;
          total_tokens_used: number;
          total_cost: number;
          user_context: Json;
          conversation_summary: string | null;
          key_insights: string[];
          action_items: string[];
          started_at: string;
          last_message_at: string;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          context_id?: string | null;
          session_title?: string | null;
          session_type?: string | null;
          status?: string;
          message_count?: number;
          total_tokens_used?: number;
          total_cost?: number;
          user_context?: Json;
          conversation_summary?: string | null;
          key_insights?: string[];
          action_items?: string[];
          started_at?: string;
          last_message_at?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          context_id?: string | null;
          session_title?: string | null;
          session_type?: string | null;
          status?: string;
          message_count?: number;
          total_tokens_used?: number;
          total_cost?: number;
          user_context?: Json;
          conversation_summary?: string | null;
          key_insights?: string[];
          action_items?: string[];
          started_at?: string;
          last_message_at?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_conversation_sessions_context_id_fkey";
            columns: ["context_id"];
            isOneToOne: false;
            referencedRelation: "ai_coaching_contexts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_conversation_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      ai_conversations: {
        Row: {
          id: string;
          user_id: string;
          conversation_id: string;
          message_type: string;
          content: string;
          context_data: Json | null;
          tokens_used: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          conversation_id: string;
          message_type: string;
          content: string;
          context_data?: Json | null;
          tokens_used?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          conversation_id?: string;
          message_type?: string;
          content?: string;
          context_data?: Json | null;
          tokens_used?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_conversations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "ai_usage_tracking_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "exercise_sets_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercise_sets_planned_exercise_id_fkey";
            columns: ["planned_exercise_id"];
            isOneToOne: false;
            referencedRelation: "planned_exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercise_sets_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "workout_sessions";
            referencedColumns: ["id"];
          }
        ];
      };
      exercises: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          instructions: Json | null;
          muscle_groups: Database["public"]["Enums"]["muscle_group_enum"][];
          primary_muscle: Database["public"]["Enums"]["muscle_group_enum"];
          equipment: Database["public"]["Enums"]["equipment_enum"][];
          difficulty: number | null;
          is_compound: boolean | null;
          alternatives: string[] | null;
          demo_video_url: string | null;
          form_cues: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          instructions?: Json | null;
          muscle_groups: Database["public"]["Enums"]["muscle_group_enum"][];
          primary_muscle: Database["public"]["Enums"]["muscle_group_enum"];
          equipment: Database["public"]["Enums"]["equipment_enum"][];
          difficulty?: number | null;
          is_compound?: boolean | null;
          alternatives?: string[] | null;
          demo_video_url?: string | null;
          form_cues?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          instructions?: Json | null;
          muscle_groups?: Database["public"]["Enums"]["muscle_group_enum"][];
          primary_muscle?: Database["public"]["Enums"]["muscle_group_enum"];
          equipment?: Database["public"]["Enums"]["equipment_enum"][];
          difficulty?: number | null;
          is_compound?: boolean | null;
          alternatives?: string[] | null;
          demo_video_url?: string | null;
          form_cues?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      monthly_ai_usage: {
        Row: {
          id: string;
          user_id: string;
          month_year: string;
          total_queries: number | null;
          total_tokens: number | null;
          total_cost: number | null;
          budget_limit: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month_year: string;
          total_queries?: number | null;
          total_tokens?: number | null;
          total_cost?: number | null;
          budget_limit?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          month_year?: string;
          total_queries?: number | null;
          total_tokens?: number | null;
          total_cost?: number | null;
          budget_limit?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "monthly_ai_usage_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      monthly_reviews: {
        Row: {
          id: string;
          user_id: string;
          review_month: string;
          workout_count: number;
          total_volume_kg: number | null;
          average_rpe: number | null;
          strength_gains: Json | null;
          goal_progress: Json | null;
          recommendations: string | null;
          achievements: string[] | null;
          areas_for_improvement: string[] | null;
          next_month_focus: string | null;
          ai_generated_at: string | null;
          tokens_used: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          review_month: string;
          workout_count?: number;
          total_volume_kg?: number | null;
          average_rpe?: number | null;
          strength_gains?: Json | null;
          goal_progress?: Json | null;
          recommendations?: string | null;
          achievements?: string[] | null;
          areas_for_improvement?: string[] | null;
          next_month_focus?: string | null;
          ai_generated_at?: string | null;
          tokens_used?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          review_month?: string;
          workout_count?: number;
          total_volume_kg?: number | null;
          average_rpe?: number | null;
          strength_gains?: Json | null;
          goal_progress?: Json | null;
          recommendations?: string | null;
          achievements?: string[] | null;
          areas_for_improvement?: string[] | null;
          next_month_focus?: string | null;
          ai_generated_at?: string | null;
          tokens_used?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "monthly_reviews_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      planned_exercises: {
        Row: {
          id: string;
          session_id: string;
          exercise_id: string;
          order_in_session: number;
          target_sets: number;
          target_reps_min: number | null;
          target_reps_max: number | null;
          target_rpe: number | null;
          rest_seconds: number | null;
          notes: string | null;
          progression_scheme: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          exercise_id: string;
          order_in_session: number;
          target_sets: number;
          target_reps_min?: number | null;
          target_reps_max?: number | null;
          target_rpe?: number | null;
          rest_seconds?: number | null;
          notes?: string | null;
          progression_scheme?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          exercise_id?: string;
          order_in_session?: number;
          target_sets?: number;
          target_reps_min?: number | null;
          target_reps_max?: number | null;
          target_rpe?: number | null;
          rest_seconds?: number | null;
          notes?: string | null;
          progression_scheme?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "planned_exercises_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planned_exercises_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "workout_plan_sessions";
            referencedColumns: ["id"];
          }
        ];
      };
      subscription_plans: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          price_cents: number;
          interval: Database["public"]["Enums"]["subscription_interval_enum"];
          features: Json;
          max_ai_queries: number | null;
          max_custom_workouts: number | null;
          max_clients: number | null;
          is_active: boolean | null;
          sort_order: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          price_cents: number;
          interval: Database["public"]["Enums"]["subscription_interval_enum"];
          features?: Json;
          max_ai_queries?: number | null;
          max_custom_workouts?: number | null;
          max_clients?: number | null;
          is_active?: boolean | null;
          sort_order?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          price_cents?: number;
          interval?: Database["public"]["Enums"]["subscription_interval_enum"];
          features?: Json;
          max_ai_queries?: number | null;
          max_custom_workouts?: number | null;
          max_clients?: number | null;
          is_active?: boolean | null;
          sort_order?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          status: Database["public"]["Enums"]["subscription_status_enum"];
          current_period_start: string;
          current_period_end: string;
          trial_start: string | null;
          trial_end: string | null;
          canceled_at: string | null;
          cancel_at_period_end: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          status: Database["public"]["Enums"]["subscription_status_enum"];
          current_period_start: string;
          current_period_end: string;
          trial_start?: string | null;
          trial_end?: string | null;
          canceled_at?: string | null;
          cancel_at_period_end?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_id?: string;
          status?: Database["public"]["Enums"]["subscription_status_enum"];
          current_period_start?: string;
          current_period_end?: string;
          trial_start?: string | null;
          trial_end?: string | null;
          canceled_at?: string | null;
          cancel_at_period_end?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      user_profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string;
          avatar_url: string | null;
          height_cm: number | null;
          weight_kg: number | null;
          birth_date: string | null;
          gender: Database["public"]["Enums"]["gender_enum"] | null;
          experience_level: Database["public"]["Enums"]["experience_level_enum"];
          fitness_goals: string[] | null;
          available_equipment: string[] | null;
          privacy_settings: Json | null;
          role: Database["public"]["Enums"]["user_role_enum"] | null;
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
          gender?: Database["public"]["Enums"]["gender_enum"] | null;
          experience_level?: Database["public"]["Enums"]["experience_level_enum"];
          fitness_goals?: string[] | null;
          available_equipment?: string[] | null;
          privacy_settings?: Json | null;
          role?: Database["public"]["Enums"]["user_role_enum"] | null;
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
          gender?: Database["public"]["Enums"]["gender_enum"] | null;
          experience_level?: Database["public"]["Enums"]["experience_level_enum"];
          fitness_goals?: string[] | null;
          available_equipment?: string[] | null;
          privacy_settings?: Json | null;
          role?: Database["public"]["Enums"]["user_role_enum"] | null;
          onboarding_completed?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      workout_plan_sessions: {
        Row: {
          id: string;
          plan_id: string;
          name: string;
          day_number: number;
          week_number: number | null;
          estimated_duration_minutes: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          name: string;
          day_number: number;
          week_number?: number | null;
          estimated_duration_minutes?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          name?: string;
          day_number?: number;
          week_number?: number | null;
          estimated_duration_minutes?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_plan_sessions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "workout_plans";
            referencedColumns: ["id"];
          }
        ];
      };
      workout_plans: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          type: Database["public"]["Enums"]["plan_type_enum"];
          frequency_per_week: number | null;
          duration_weeks: number | null;
          difficulty: number | null;
          target_experience: Database["public"]["Enums"]["experience_level_enum"][];
          created_by: string | null;
          is_template: boolean | null;
          is_public: boolean | null;
          tags: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          type: Database["public"]["Enums"]["plan_type_enum"];
          frequency_per_week?: number | null;
          duration_weeks?: number | null;
          difficulty?: number | null;
          target_experience: Database["public"]["Enums"]["experience_level_enum"][];
          created_by?: string | null;
          is_template?: boolean | null;
          is_public?: boolean | null;
          tags?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          type?: Database["public"]["Enums"]["plan_type_enum"];
          frequency_per_week?: number | null;
          duration_weeks?: number | null;
          difficulty?: number | null;
          target_experience?: Database["public"]["Enums"]["experience_level_enum"][];
          created_by?: string | null;
          is_template?: boolean | null;
          is_public?: boolean | null;
          tags?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_plans_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          }
        ];
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
          sync_status: Database["public"]["Enums"]["sync_status_enum"] | null;
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
          sync_status?: Database["public"]["Enums"]["sync_status_enum"] | null;
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
          sync_status?: Database["public"]["Enums"]["sync_status_enum"] | null;
          offline_created?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_sessions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "workout_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_sessions_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "workout_plan_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      calculate_one_rep_max: {
        Args: {
          weight: number;
          reps: number;
        };
        Returns: number;
      };
      check_ai_budget: {
        Args: {
          user_uuid: string;
        };
        Returns: Json;
      };
      generate_monthly_review_data: {
        Args: {
          user_uuid: string;
          target_month: string;
        };
        Returns: Json;
      };
      get_monthly_conversation_count: {
        Args: {
          user_uuid: string;
        };
        Returns: number;
      };
      get_user_subscription_status: {
        Args: {
          user_uuid: string;
        };
        Returns: string;
      };
      user_has_feature_access: {
        Args: {
          user_uuid: string;
          required_features: string[];
        };
        Returns: boolean;
      };
    };
    Enums: {
      equipment_enum:
        | "barbell"
        | "dumbbell"
        | "kettlebell"
        | "cable"
        | "machine"
        | "bodyweight"
        | "resistance_band"
        | "plate";
      experience_level_enum: "untrained" | "beginner" | "early_intermediate" | "intermediate" | "advanced";
      gender_enum: "male" | "female" | "other" | "prefer_not_to_say";
      muscle_group_enum:
        | "chest"
        | "back"
        | "shoulders"
        | "biceps"
        | "triceps"
        | "forearms"
        | "quadriceps"
        | "hamstrings"
        | "glutes"
        | "calves"
        | "abs"
        | "core";
      plan_type_enum: "full_body" | "upper_lower" | "body_part_split" | "custom";
      subscription_interval_enum: "month" | "year";
      subscription_status_enum:
        | "active"
        | "canceled"
        | "incomplete"
        | "incomplete_expired"
        | "past_due"
        | "trialing"
        | "unpaid";
      sync_status_enum: "synced" | "pending" | "conflict";
      user_role_enum: "user" | "premium" | "coach" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// ============================================================================
// CONVENIENCE TYPE EXPORTS
// ============================================================================

// Table row types
export type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];
export type WorkoutSession = Database["public"]["Tables"]["workout_sessions"]["Row"];
export type ExerciseSet = Database["public"]["Tables"]["exercise_sets"]["Row"];
export type Exercise = Database["public"]["Tables"]["exercises"]["Row"];
export type WorkoutPlan = Database["public"]["Tables"]["workout_plans"]["Row"];
export type WorkoutPlanSession = Database["public"]["Tables"]["workout_plan_sessions"]["Row"];
export type PlannedExercise = Database["public"]["Tables"]["planned_exercises"]["Row"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type SubscriptionPlan = Database["public"]["Tables"]["subscription_plans"]["Row"];
export type AIUsageTracking = Database["public"]["Tables"]["ai_usage_tracking"]["Row"];
export type MonthlyAIUsage = Database["public"]["Tables"]["monthly_ai_usage"]["Row"];
export type AIConversation = Database["public"]["Tables"]["ai_conversations"]["Row"];
export type MonthlyReview = Database["public"]["Tables"]["monthly_reviews"]["Row"];

// Insert types
export type UserProfileInsert = Database["public"]["Tables"]["user_profiles"]["Insert"];
export type WorkoutSessionInsert = Database["public"]["Tables"]["workout_sessions"]["Insert"];
export type ExerciseSetInsert = Database["public"]["Tables"]["exercise_sets"]["Insert"];
export type ExerciseInsert = Database["public"]["Tables"]["exercises"]["Insert"];
export type WorkoutPlanInsert = Database["public"]["Tables"]["workout_plans"]["Insert"];
export type SubscriptionInsert = Database["public"]["Tables"]["subscriptions"]["Insert"];
export type AIUsageTrackingInsert = Database["public"]["Tables"]["ai_usage_tracking"]["Insert"];
export type AIConversationInsert = Database["public"]["Tables"]["ai_conversations"]["Insert"];

// Update types
export type UserProfileUpdate = Database["public"]["Tables"]["user_profiles"]["Update"];
export type WorkoutSessionUpdate = Database["public"]["Tables"]["workout_sessions"]["Update"];
export type ExerciseSetUpdate = Database["public"]["Tables"]["exercise_sets"]["Update"];
export type ExerciseUpdate = Database["public"]["Tables"]["exercises"]["Update"];
export type WorkoutPlanUpdate = Database["public"]["Tables"]["workout_plans"]["Update"];
export type SubscriptionUpdate = Database["public"]["Tables"]["subscriptions"]["Update"];

// Enum types
export type ExperienceLevel = Database["public"]["Enums"]["experience_level_enum"];
export type Gender = Database["public"]["Enums"]["gender_enum"];
export type MuscleGroup = Database["public"]["Enums"]["muscle_group_enum"];
export type Equipment = Database["public"]["Enums"]["equipment_enum"];
export type PlanType = Database["public"]["Enums"]["plan_type_enum"];
export type SyncStatus = Database["public"]["Enums"]["sync_status_enum"];
export type SubscriptionStatus = Database["public"]["Enums"]["subscription_status_enum"];
export type SubscriptionInterval = Database["public"]["Enums"]["subscription_interval_enum"];
export type UserRole = Database["public"]["Enums"]["user_role_enum"];

// Function return types
export type AIBudgetCheck = {
  within_budget: boolean;
  remaining_budget: number;
  total_cost: number;
  total_queries: number;
  budget_limit?: number;
};

export type MonthlyReviewData = {
  workout_count: number;
  total_volume_kg: number;
  average_rpe: number;
  average_duration_minutes: number;
  strength_gains: Record<
    string,
    {
      max_weight: number;
      max_reps: number;
      estimated_1rm: number;
      total_sets: number;
    }
  >;
  consistency_score: string;
};

// ============================================================================
// EXTENDED TYPES WITH RELATIONSHIPS
// ============================================================================

export type WorkoutSessionWithSets = WorkoutSession & {
  exercise_sets: ExerciseSet[];
};

export type WorkoutPlanWithSessions = WorkoutPlan & {
  workout_plan_sessions: (WorkoutPlanSession & {
    planned_exercises: (PlannedExercise & {
      exercises: Exercise;
    })[];
  })[];
};

export type ExerciseSetWithExercise = ExerciseSet & {
  exercises: Exercise;
};

export type UserProfileWithSubscription = UserProfile & {
  subscriptions?: (Subscription & {
    subscription_plans: SubscriptionPlan;
  })[];
};

export type AIConversationWithUsage = AIConversation & {
  ai_usage_tracking?: AIUsageTracking[];
};

// ============================================================================
// UTILITY TYPES FOR API RESPONSES
// ============================================================================

export type DatabaseResponse<T> = {
  data: T | null;
  error: {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
  } | null;
};

export type DatabaseArrayResponse<T> = {
  data: T[] | null;
  error: {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
  } | null;
};

// ============================================================================
// REAL-TIME SUBSCRIPTION TYPES
// ============================================================================

export type RealtimePayload<T = any> = {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T | null;
  old: T | null;
  errors: string[] | null;
};

export type WorkoutSessionRealtimePayload = RealtimePayload<WorkoutSession>;
export type AIConversationRealtimePayload = RealtimePayload<AIConversation>;
export type SubscriptionRealtimePayload = RealtimePayload<Subscription>;

// ============================================================================
// QUERY BUILDER TYPES
// ============================================================================

export type QueryFilter<T> = {
  [K in keyof T]?:
    | T[K]
    | {
        eq?: T[K];
        neq?: T[K];
        gt?: T[K];
        gte?: T[K];
        lt?: T[K];
        lte?: T[K];
        like?: string;
        ilike?: string;
        in?: T[K][];
        is?: null | boolean;
      };
};

// ============================================================================
// EXPORT ALL TYPES
// ============================================================================

export default Database;
