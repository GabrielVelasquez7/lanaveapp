import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'

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

function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'La contraseña debe tener al menos 8 caracteres' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'La contraseña debe contener al menos una mayúscula' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'La contraseña debe contener al menos una minúscula' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'La contraseña debe contener al menos un número' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: 'La contraseña debe contener al menos un carácter especial (!@#$%^&*()_+-=[]{};\':\"\\|,.<>/?)' };
  }
  return { valid: true };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      return new Response(
        JSON.stringify({ error: 'Internal server error: Supabase credentials not configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

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
      console.log(`Unauthorized attempt to create user by: ${requestingUser.id}, role: ${roleData?.role}`);
      return new Response(
        JSON.stringify({ error: 'Solo administradores pueden crear usuarios' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    const { data: canProceed, error: rateLimitError } = await supabaseAdmin.rpc('check_rate_limit', {
      operation_type: 'create_user',
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

    const { email, password, full_name, role, agency_id } = await req.json()

    // Validate required fields
    if (!email || !password || !full_name || !role) {
      return new Response(
        JSON.stringify({ error: 'Email, contraseña, nombre completo y rol son requeridos.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate password strength on backend
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return new Response(
        JSON.stringify({ error: passwordValidation.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role
    const validRoles = ['taquillero', 'encargado', 'administrador', 'encargada'];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Rol inválido. Debe ser uno de: ${validRoles.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create user using Supabase Admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
        agency_id: agency_id || null
      }
    })

    if (createError) {
      console.error('Error creating user:', createError)
      
      if (createError.message.includes('already been registered')) {
        return new Response(
          JSON.stringify({ error: 'Este correo electrónico ya está registrado.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log security event
    try {
      await supabaseAdmin.rpc('log_security_event', {
        p_user_id: requestingUser.id,
        p_event_type: 'user_created',
        p_details: {
          created_user_id: newUser.user?.id,
          created_user_email: email,
          role: role,
          agency_id: agency_id || null
        }
      });
    } catch (logError) {
      console.error('Error logging security event:', logError);
      // Don't fail the request if logging fails
    }

    console.log('User created successfully:', newUser.user?.id)

    return new Response(
      JSON.stringify({ 
        user: newUser.user,
        message: 'Usuario creado exitosamente' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error in create-user function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor', details: errorMessage }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  }
})
