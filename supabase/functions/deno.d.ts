// ============================================================================
// DENO TYPE DECLARATIONS FOR SUPABASE EDGE FUNCTIONS
// ============================================================================

declare global {
  namespace Deno {
    interface Env {
      get(key: string): string | undefined;
    }

    const env: Env;
  }

  // Supabase Edge Functions serve function
  function serve(handler: (request: Request) => Response | Promise<Response>, options?: { port?: number }): void;
}

// Module declarations for external dependencies
declare module "https://esm.sh/@supabase/supabase-js@2" {
  export function createClient(url: string, key: string, options?: any): any;
}

export {};
