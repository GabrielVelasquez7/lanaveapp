import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== CREATE USER FUNCTION START ===')
    
    // Create Supabase client with service role key for admin operations (MUST come from env)
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')

    if (!serviceRoleKey || !supabaseUrl) {
      console.error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL in environment')
      return new Response(
        JSON.stringify({ error: 'Misconfigured Supabase service role environment' }),
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

    const requestData = await req.json()
    const { email, password, full_name, role, agency_id } = requestData

    console.log('Request data received:', { 
      email, 
      full_name, 
      role, 
      agency_id,
      hasPassword: !!password 
    })

    // Validate required fields
    if (!email || !password || !full_name || !role) {
      console.error('Missing required fields')
      return new Response(
        JSON.stringify({ error: 'Email, contraseña, nombre y rol son obligatorios' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      console.error('Invalid email format:', email)
      return new Response(
        JSON.stringify({ error: 'El formato del correo electrónico no es válido' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate password requirements
    if (password.length < 6) {
      console.error('Password too short:', password.length)
      return new Response(
        JSON.stringify({ error: 'La contraseña debe tener al menos 6 caracteres' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate role
    const validRoles = ['taquillero', 'encargado', 'administrador', 'encargada']
    if (!validRoles.includes(role)) {
      console.error('Invalid role:', role)
      return new Response(
        JSON.stringify({ error: 'Rol inválido. Debe ser taquillero, encargado, administrador o encargada' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Creating user in auth.users...')
    
    // Create user in auth.users table
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { 
        full_name,
        role,
        agency_id: agency_id && agency_id !== 'none' ? agency_id : null
      },
      email_confirm: true // Auto-confirm email
    })

    if (authError) {
      console.error('Auth error details:', {
        message: authError.message,
        status: authError.status,
        code: authError.code,
        details: authError
      })
      
      // More specific error messages in Spanish
      let errorMessage = authError.message
      const errorMsgLower = authError.message?.toLowerCase() || ''
      
      // Email already exists
      if (errorMsgLower.includes('already been registered') || 
          errorMsgLower.includes('already registered') ||
          authError.code === 'email_exists' ||
          errorMsgLower.includes('user already registered')) {
        errorMessage = 'Este correo ya está registrado en el sistema. Usa otro correo o edita el usuario existente.'
      } 
      // Password errors
      else if (errorMsgLower.includes('password') || 
               errorMsgLower.includes('contraseña') ||
               errorMsgLower.includes('6 characters') ||
               errorMsgLower.includes('6 caracteres') ||
               errorMsgLower.includes('too short') ||
               errorMsgLower.includes('demasiado corta')) {
        errorMessage = 'La contraseña debe tener al menos 6 caracteres'
      }
      // Email format errors
      else if (errorMsgLower.includes('email') && 
               (errorMsgLower.includes('invalid') || 
                errorMsgLower.includes('format') ||
                errorMsgLower.includes('inválido'))) {
        errorMessage = 'El formato del correo electrónico no es válido'
      }
      // Generic email errors
      else if (errorMsgLower.includes('email')) {
        errorMessage = 'Error con el correo electrónico. Verifica que sea válido.'
      }
      // Default: return a user-friendly message
      else {
        errorMessage = 'Error al crear el usuario. Verifica que todos los datos sean correctos.'
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('User created successfully:', authData.user?.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: authData.user.id,
          email: authData.user.email,
          full_name: full_name,
          role: role
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error in create-user function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})