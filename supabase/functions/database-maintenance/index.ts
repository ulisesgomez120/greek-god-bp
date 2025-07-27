// ============================================================================
// DATABASE MAINTENANCE FUNCTION
// ============================================================================
// Automated maintenance tasks for the TrainSmart database including
// cleanup, optimization, analytics updates, and health monitoring
// Version: 1.0.0

/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface ViewResult {
  view: string;
  success: boolean;
  error?: string;
}

interface MaintenanceResult {
  task: string;
  success: boolean;
  duration_ms: number;
  records_affected?: number;
  error?: string;
  details?: any;
}

interface MaintenanceReport {
  execution_id: string;
  started_at: string;
  completed_at: string;
  total_duration_ms: number;
  tasks_completed: number;
  tasks_failed: number;
  results: MaintenanceResult[];
  overall_status: "success" | "partial_failure" | "failure";
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAINTENANCE_CONFIG = {
  // Data retention periods (in days)
  RETENTION_PERIODS: {
    ai_conversations: 365, // 1 year
    ai_learning_data: 730, // 2 years
    exercise_search_analytics: 90, // 3 months
    ai_system_alerts_resolved: 90, // 3 months
    payment_history: 2555, // 7 years (legal requirement)
    workout_sessions_deleted: 30, // 30 days for soft deletes
  },

  // Performance thresholds
  PERFORMANCE_THRESHOLDS: {
    max_query_time_ms: 5000,
    max_index_bloat_ratio: 0.3,
    min_cache_hit_ratio: 0.95,
  },

  // Batch sizes for large operations
  BATCH_SIZES: {
    cleanup_records: 1000,
    reindex_threshold: 10000,
    vacuum_threshold: 1000,
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function createSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function generateExecutionId(): string {
  return `maint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function executeWithTiming<T>(taskName: string, operation: () => Promise<T>): Promise<MaintenanceResult> {
  const startTime = Date.now();

  try {
    const result = await operation();
    const duration = Date.now() - startTime;

    return {
      task: taskName,
      success: true,
      duration_ms: duration,
      details: result,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    return {
      task: taskName,
      success: false,
      duration_ms: duration,
      error: error.message,
      details: error,
    };
  }
}

// ============================================================================
// MAINTENANCE TASKS
// ============================================================================

class DatabaseMaintenance {
  private supabase: any;
  private results: MaintenanceResult[] = [];

  constructor() {
    this.supabase = createSupabaseClient();
  }

  // Clean up old conversation data
  async cleanupOldConversations(): Promise<MaintenanceResult> {
    return executeWithTiming("cleanup_old_conversations", async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - MAINTENANCE_CONFIG.RETENTION_PERIODS.ai_conversations);

      // Archive old completed conversations
      const { data: archivedSessions, error: archiveError } = await this.supabase
        .from("ai_conversation_sessions")
        .update({ status: "archived" })
        .eq("status", "completed")
        .lt("completed_at", cutoffDate.toISOString())
        .select("id");

      if (archiveError) throw archiveError;

      // Delete old learning data
      const learningCutoff = new Date();
      learningCutoff.setDate(learningCutoff.getDate() - MAINTENANCE_CONFIG.RETENTION_PERIODS.ai_learning_data);

      const { data: deletedLearning, error: learningError } = await this.supabase
        .from("ai_learning_data")
        .delete()
        .lt("created_at", learningCutoff.toISOString())
        .select("id");

      if (learningError) throw learningError;

      return {
        archived_sessions: archivedSessions?.length || 0,
        deleted_learning_records: deletedLearning?.length || 0,
      };
    });
  }

  // Clean up old search analytics
  async cleanupSearchAnalytics(): Promise<MaintenanceResult> {
    return executeWithTiming("cleanup_search_analytics", async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - MAINTENANCE_CONFIG.RETENTION_PERIODS.exercise_search_analytics);

      const { data: deleted, error } = await this.supabase
        .from("exercise_search_analytics")
        .delete()
        .lt("created_at", cutoffDate.toISOString())
        .select("id");

      if (error) throw error;

      return {
        deleted_records: deleted?.length || 0,
      };
    });
  }

  // Clean up resolved system alerts
  async cleanupSystemAlerts(): Promise<MaintenanceResult> {
    return executeWithTiming("cleanup_system_alerts", async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - MAINTENANCE_CONFIG.RETENTION_PERIODS.ai_system_alerts_resolved);

      const { data: deleted, error } = await this.supabase
        .from("ai_system_alerts")
        .delete()
        .eq("status", "resolved")
        .lt("resolved_at", cutoffDate.toISOString())
        .select("id");

      if (error) throw error;

      return {
        deleted_alerts: deleted?.length || 0,
      };
    });
  }

  // Update exercise popularity scores
  async updateExercisePopularity(): Promise<MaintenanceResult> {
    return executeWithTiming("update_exercise_popularity", async () => {
      const { data, error } = await this.supabase.rpc("update_exercise_popularity");

      if (error) throw error;

      return {
        function_executed: true,
        result: data,
      };
    });
  }

  // Refresh materialized views
  async refreshMaterializedViews(): Promise<MaintenanceResult> {
    return executeWithTiming("refresh_materialized_views", async () => {
      const views = [
        "workout_performance_analytics",
        "strength_progression_analytics",
        "user_performance_rankings",
        "exercise_search_cache",
      ];

      const results: ViewResult[] = [];

      for (const view of views) {
        try {
          const { error } = await this.supabase.rpc("refresh_materialized_view", {
            view_name: view,
          });

          if (error) throw error;

          results.push({ view, success: true });
        } catch (error: any) {
          results.push({ view, success: false, error: error.message });
        }
      }

      return {
        views_refreshed: results.filter((r) => r.success).length,
        views_failed: results.filter((r) => !r.success).length,
        details: results,
      };
    });
  }

  // Update goal progress for all active goals
  async updateGoalProgress(): Promise<MaintenanceResult> {
    return executeWithTiming("update_goal_progress", async () => {
      // Get all active goals
      const { data: activeGoals, error: goalsError } = await this.supabase
        .from("fitness_goals")
        .select("id")
        .eq("is_active", true);

      if (goalsError) throw goalsError;

      let successCount = 0;
      let errorCount = 0;

      // Update each goal in batches
      const batchSize = MAINTENANCE_CONFIG.BATCH_SIZES.cleanup_records;

      for (let i = 0; i < activeGoals.length; i += batchSize) {
        const batch = activeGoals.slice(i, i + batchSize);

        for (const goal of batch) {
          try {
            const { error } = await this.supabase.rpc("update_goal_progress", {
              p_goal_id: goal.id,
            });

            if (error) throw error;
            successCount++;
          } catch (error) {
            errorCount++;
          }
        }
      }

      return {
        total_goals: activeGoals.length,
        updated_successfully: successCount,
        update_errors: errorCount,
      };
    });
  }

  // Check and award achievements
  async checkAchievements(): Promise<MaintenanceResult> {
    return executeWithTiming("check_achievements", async () => {
      // Get all users (in batches to avoid memory issues)
      const { data: users, error: usersError } = await this.supabase.from("user_profiles").select("id").limit(1000); // Process in batches

      if (usersError) throw usersError;

      let totalAchievements = 0;
      let processedUsers = 0;

      for (const user of users) {
        try {
          const { data: achievementCount, error } = await this.supabase.rpc("check_user_achievements", {
            p_user_id: user.id,
          });

          if (error) throw error;

          totalAchievements += achievementCount || 0;
          processedUsers++;
        } catch (error) {
          console.error(`Error checking achievements for user ${user.id}:`, error);
        }
      }

      return {
        processed_users: processedUsers,
        total_achievements_awarded: totalAchievements,
      };
    });
  }

  // Database health check
  async performHealthCheck(): Promise<MaintenanceResult> {
    return executeWithTiming("database_health_check", async () => {
      const healthMetrics = {
        table_sizes: {},
        index_usage: {},
        slow_queries: [],
        connection_stats: {},
        cache_hit_ratio: 0,
      };

      // Get table sizes
      const { data: tableSizes, error: sizeError } = await this.supabase.rpc("get_table_sizes");
      if (!sizeError && tableSizes) {
        healthMetrics.table_sizes = tableSizes;
      }

      // Get index usage statistics
      const { data: indexStats, error: indexError } = await this.supabase.rpc("get_index_usage_stats");
      if (!indexError && indexStats) {
        healthMetrics.index_usage = indexStats;
      }

      // Check cache hit ratio
      const { data: cacheStats, error: cacheError } = await this.supabase.rpc("get_cache_hit_ratio");
      if (!cacheError && cacheStats) {
        healthMetrics.cache_hit_ratio = cacheStats;
      }

      return healthMetrics;
    });
  }

  // Generate maintenance report
  async generateMaintenanceReport(): Promise<MaintenanceResult> {
    return executeWithTiming("generate_maintenance_report", async () => {
      const report = {
        total_users: 0,
        active_subscriptions: 0,
        total_workouts_last_30_days: 0,
        ai_conversations_last_30_days: 0,
        database_size_mb: 0,
        top_exercises: [],
        subscription_metrics: {},
      };

      // Get user count
      const { count: userCount } = await this.supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true });
      report.total_users = userCount || 0;

      // Get active subscriptions
      const { count: activeSubsCount } = await this.supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      report.active_subscriptions = activeSubsCount || 0;

      // Get recent workout count
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: workoutCount } = await this.supabase
        .from("workout_sessions")
        .select("*", { count: "exact", head: true })
        .gte("started_at", thirtyDaysAgo.toISOString());
      report.total_workouts_last_30_days = workoutCount || 0;

      // Get AI conversation count
      const { count: aiConversationCount } = await this.supabase
        .from("ai_conversation_sessions")
        .select("*", { count: "exact", head: true })
        .gte("started_at", thirtyDaysAgo.toISOString());
      report.ai_conversations_last_30_days = aiConversationCount || 0;

      return report;
    });
  }

  // Execute all maintenance tasks
  async executeAllTasks(): Promise<MaintenanceReport> {
    const executionId = generateExecutionId();
    const startTime = new Date();

    console.log(`Starting database maintenance execution: ${executionId}`);

    // Define all maintenance tasks
    const tasks = [
      () => this.cleanupOldConversations(),
      () => this.cleanupSearchAnalytics(),
      () => this.cleanupSystemAlerts(),
      () => this.updateExercisePopularity(),
      () => this.refreshMaterializedViews(),
      () => this.updateGoalProgress(),
      () => this.checkAchievements(),
      () => this.performHealthCheck(),
      () => this.generateMaintenanceReport(),
    ];

    // Execute all tasks
    for (const task of tasks) {
      const result = await task();
      this.results.push(result);

      console.log(
        `Completed task: ${result.task} (${result.success ? "SUCCESS" : "FAILED"}) - ${result.duration_ms}ms`
      );

      if (!result.success) {
        console.error(`Task failed: ${result.task}`, result.error);
      }
    }

    const endTime = new Date();
    const totalDuration = endTime.getTime() - startTime.getTime();

    const successfulTasks = this.results.filter((r) => r.success).length;
    const failedTasks = this.results.filter((r) => !r.success).length;

    const report: MaintenanceReport = {
      execution_id: executionId,
      started_at: startTime.toISOString(),
      completed_at: endTime.toISOString(),
      total_duration_ms: totalDuration,
      tasks_completed: successfulTasks,
      tasks_failed: failedTasks,
      results: this.results,
      overall_status: failedTasks === 0 ? "success" : successfulTasks > 0 ? "partial_failure" : "failure",
    };

    // Log the maintenance report
    try {
      await this.supabase.from("maintenance_logs").insert({
        execution_id: executionId,
        started_at: startTime.toISOString(),
        completed_at: endTime.toISOString(),
        total_duration_ms: totalDuration,
        tasks_completed: successfulTasks,
        tasks_failed: failedTasks,
        report_data: report,
        status: report.overall_status,
      });
    } catch (error) {
      console.error("Failed to log maintenance report:", error);
    }

    return report;
  }
}

// ============================================================================
// EDGE FUNCTION HANDLER
// ============================================================================

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify authorization (optional - can be called by cron or admin)
    const authHeader = req.headers.get("Authorization");
    const isAuthorized =
      authHeader?.includes("Bearer") || req.headers.get("x-maintenance-key") === Deno.env.get("MAINTENANCE_SECRET_KEY");

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body for specific task execution (optional)
    let requestBody: any = {};
    try {
      if (req.body) {
        requestBody = await req.json();
      }
    } catch (error) {
      // Ignore JSON parsing errors for empty bodies
    }

    // Execute maintenance tasks
    const maintenance = new DatabaseMaintenance();
    const report = await maintenance.executeAllTasks();

    // Return the maintenance report
    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Database maintenance error:", error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ============================================================================
// ADDITIONAL HELPER FUNCTIONS (for RPC calls)
// ============================================================================

// These would be implemented as PostgreSQL functions in the database
// and called via supabase.rpc() in the maintenance tasks above

/*
-- Example PostgreSQL functions that would be created:

CREATE OR REPLACE FUNCTION get_table_sizes()
RETURNS TABLE(table_name TEXT, size_bytes BIGINT, row_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    schemaname||'.'||tablename as table_name,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
    n_tup_ins - n_tup_del as row_count
  FROM pg_stat_user_tables
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_index_usage_stats()
RETURNS TABLE(index_name TEXT, table_name TEXT, scans BIGINT, tuples_read BIGINT, tuples_fetched BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    indexrelname as index_name,
    relname as table_name,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
  FROM pg_stat_user_indexes
  ORDER BY idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_cache_hit_ratio()
RETURNS DECIMAL AS $$
BEGIN
  RETURN (
    SELECT ROUND(
      (sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read))) * 100, 2
    )
    FROM pg_statio_user_tables
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_materialized_view(view_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  EXECUTE 'REFRESH MATERIALIZED VIEW ' || view_name;
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Maintenance logs table
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  total_duration_ms INTEGER NOT NULL,
  tasks_completed INTEGER NOT NULL,
  tasks_failed INTEGER NOT NULL,
  report_data JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial_failure', 'failure')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_maintenance_logs_execution_id ON maintenance_logs(execution_id);
CREATE INDEX idx_maintenance_logs_status_date ON maintenance_logs(status, started_at DESC);
*/
