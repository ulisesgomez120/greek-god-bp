// ============================================================================
// CORS CONFIGURATION FOR SUPABASE EDGE FUNCTIONS
// ============================================================================
// Shared CORS utilities for all Edge Functions

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

export function handleCors(req: Request): Response | null {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
      status: 200,
    });
  }

  return null;
}

export function createResponse(
  data: any,
  status: number = 200,
  additionalHeaders: Record<string, string> = {}
): Response {
  const headers = {
    "Content-Type": "application/json",
    ...corsHeaders,
    ...additionalHeaders,
  };

  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

export function createErrorResponse(message: string, status: number = 400, code?: string): Response {
  return createResponse(
    {
      error: message,
      code,
      success: false,
    },
    status
  );
}

export function createSuccessResponse(data: any, message?: string): Response {
  return createResponse({
    data,
    message,
    success: true,
  });
}
