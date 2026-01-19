import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0"

const allowedOrigins = [
  'https://bdd3ec42-db8e-4092-9bdf-a0870d4f520c.lovableproject.com',
  'https://lanavetest.lovable.app',
  'https://id-preview--bdd3ec42-db8e-4092-9bdf-a0870d4f520c.lovable.app',
  'https://loterialanave.online'
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment")
      return new Response(
        JSON.stringify({ error: "Supabase service role not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Verify that the requesting user is an administrator
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'No autorizado: Token de autenticación requerido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Token de autenticación inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if requesting user is administrator
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .single();

    if (roleError || roleData?.role !== 'administrador') {
      console.log(`Unauthorized attempt to delete user by: ${requestingUser.id}, role: ${roleData?.role}`);
      return new Response(
        JSON.stringify({ error: 'Solo administradores pueden eliminar usuarios' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    const { data: canProceed, error: rateLimitError } = await supabaseAdmin.rpc('check_rate_limit', {
      operation_type: 'delete_user',
      max_per_hour: 20
    });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
    }

    if (canProceed === false) {
      return new Response(
        JSON.stringify({ error: 'Demasiadas solicitudes. Intente nuevamente más tarde.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user_id } = await req.json()

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id es requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    // Prevent admin from deleting themselves
    if (user_id === requestingUser.id) {
      return new Response(
        JSON.stringify({ error: "No puede eliminarse a sí mismo" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    // Get user info before deletion for audit log
    const { data: userToDelete } = await supabaseAdmin.auth.admin.getUserById(user_id);
    const deletedUserEmail = userToDelete?.user?.email || 'unknown';

    // Borrar primero de tablas dependientes (user_roles, profiles)
    const { error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", user_id)

    if (rolesError) {
      console.error("Error deleting from user_roles:", rolesError)
      return new Response(
        JSON.stringify({ error: "No se pudo eliminar los roles del usuario" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const { error: profilesError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("user_id", user_id)

    if (profilesError) {
      console.error("Error deleting from profiles:", profilesError)
      return new Response(
        JSON.stringify({ error: "No se pudo eliminar el perfil del usuario" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    // Finalmente, eliminar de auth.users
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id)

    if (authDeleteError) {
      console.error("Error deleting auth user:", authDeleteError)
      return new Response(
        JSON.stringify({ error: "No se pudo eliminar el usuario de autenticación" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    // Log security event
    try {
      await supabaseAdmin.rpc('log_security_event', {
        p_user_id: requestingUser.id,
        p_event_type: 'user_deleted',
        p_details: {
          deleted_user_id: user_id,
          deleted_user_email: deletedUserEmail
        }
      });
    } catch (logError) {
      console.error('Error logging security event:', logError);
      // Don't fail the request if logging fails
    }

    console.log(`User ${user_id} deleted successfully by admin ${requestingUser.id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (err) {
    console.error("Unexpected error in delete-user function:", err)
    return new Response(
      JSON.stringify({
        error: "Error interno del servidor",
        details: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    )
  }
})
