// ============================================================================
// DENO TYPE DECLARATIONS FOR SUPABASE EDGE FUNCTIONS
// ============================================================================

declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
  }

  export const env: Env;

  export function serve(handler: (request: Request) => Response | Promise<Response>, options?: { port?: number }): void;
}

// Global Deno namespace
declare const Deno: typeof Deno;
