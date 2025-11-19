export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agencies: {
        Row: {
          address: string | null
          created_at: string
          group_id: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agencies_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "agency_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      banqueo_transactions: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          id: string
          lottery_system_id: string | null
          participation_percentage: number
          participation2_percentage: number
          prizes_bs: number
          prizes_usd: number
          sales_bs: number
          sales_usd: number
          updated_at: string
          week_end_date: string
          week_start_date: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by: string
          id?: string
          lottery_system_id?: string | null
          participation_percentage?: number
          participation2_percentage?: number
          prizes_bs?: number
          prizes_usd?: number
          sales_bs?: number
          sales_usd?: number
          updated_at?: string
          week_end_date: string
          week_start_date: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          id?: string
          lottery_system_id?: string | null
          participation_percentage?: number
          participation2_percentage?: number
          prizes_bs?: number
          prizes_usd?: number
          sales_bs?: number
          sales_usd?: number
          updated_at?: string
          week_end_date?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "banqueo_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banqueo_transactions_lottery_system_id_fkey"
            columns: ["lottery_system_id"]
            isOneToOne: false
            referencedRelation: "lottery_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "agency_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_cuadres_summary: {
        Row: {
          agency_id: string | null
          balance_before_pending_prizes_bs: number | null
          balance_bs: number
          cash_available_bs: number
          cash_available_usd: number
          closure_notes: string | null
          created_at: string
          daily_closure_confirmed: boolean
          diferencia_final: number
          encargada_observations: string | null
          encargada_reviewed_at: string | null
          encargada_reviewed_by: string | null
          encargada_status: string | null
          excess_usd: number
          exchange_rate: number
          id: string
          is_closed: boolean
          is_weekly_closed: boolean | null
          lottery_system_id: string | null
          notes: string | null
          pending_prizes: number
          session_date: string
          session_id: string | null
          total_banco_bs: number
          total_debt_bs: number | null
          total_debt_usd: number | null
          total_expenses_bs: number
          total_expenses_usd: number
          total_mobile_payments_bs: number
          total_pos_bs: number
          total_prizes_bs: number
          total_prizes_usd: number
          total_sales_bs: number
          total_sales_usd: number
          updated_at: string
          user_id: string
          week_end_date: string | null
          week_start_date: string | null
          weekly_closure_notes: string | null
        }
        Insert: {
          agency_id?: string | null
          balance_before_pending_prizes_bs?: number | null
          balance_bs?: number
          cash_available_bs?: number
          cash_available_usd?: number
          closure_notes?: string | null
          created_at?: string
          daily_closure_confirmed?: boolean
          diferencia_final?: number
          encargada_observations?: string | null
          encargada_reviewed_at?: string | null
          encargada_reviewed_by?: string | null
          encargada_status?: string | null
          excess_usd?: number
          exchange_rate?: number
          id?: string
          is_closed?: boolean
          is_weekly_closed?: boolean | null
          lottery_system_id?: string | null
          notes?: string | null
          pending_prizes?: number
          session_date: string
          session_id?: string | null
          total_banco_bs?: number
          total_debt_bs?: number | null
          total_debt_usd?: number | null
          total_expenses_bs?: number
          total_expenses_usd?: number
          total_mobile_payments_bs?: number
          total_pos_bs?: number
          total_prizes_bs?: number
          total_prizes_usd?: number
          total_sales_bs?: number
          total_sales_usd?: number
          updated_at?: string
          user_id: string
          week_end_date?: string | null
          week_start_date?: string | null
          weekly_closure_notes?: string | null
        }
        Update: {
          agency_id?: string | null
          balance_before_pending_prizes_bs?: number | null
          balance_bs?: number
          cash_available_bs?: number
          cash_available_usd?: number
          closure_notes?: string | null
          created_at?: string
          daily_closure_confirmed?: boolean
          diferencia_final?: number
          encargada_observations?: string | null
          encargada_reviewed_at?: string | null
          encargada_reviewed_by?: string | null
          encargada_status?: string | null
          excess_usd?: number
          exchange_rate?: number
          id?: string
          is_closed?: boolean
          is_weekly_closed?: boolean | null
          lottery_system_id?: string | null
          notes?: string | null
          pending_prizes?: number
          session_date?: string
          session_id?: string | null
          total_banco_bs?: number
          total_debt_bs?: number | null
          total_debt_usd?: number | null
          total_expenses_bs?: number
          total_expenses_usd?: number
          total_mobile_payments_bs?: number
          total_pos_bs?: number
          total_prizes_bs?: number
          total_prizes_usd?: number
          total_sales_bs?: number
          total_sales_usd?: number
          updated_at?: string
          user_id?: string
          week_end_date?: string | null
          week_start_date?: string | null
          weekly_closure_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_cuadres_summary_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_cuadres_summary_lottery_system_id_fkey"
            columns: ["lottery_system_id"]
            isOneToOne: false
            referencedRelation: "lottery_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_cuadres_summary_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "daily_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sessions: {
        Row: {
          cash_available_bs: number | null
          cash_available_usd: number | null
          closure_notes: string | null
          created_at: string
          daily_closure_confirmed: boolean | null
          exchange_rate: number | null
          id: string
          is_closed: boolean
          notes: string | null
          session_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cash_available_bs?: number | null
          cash_available_usd?: number | null
          closure_notes?: string | null
          created_at?: string
          daily_closure_confirmed?: boolean | null
          exchange_rate?: number | null
          id?: string
          is_closed?: boolean
          notes?: string | null
          session_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cash_available_bs?: number | null
          cash_available_usd?: number | null
          closure_notes?: string | null
          created_at?: string
          daily_closure_confirmed?: boolean | null
          exchange_rate?: number | null
          id?: string
          is_closed?: boolean
          notes?: string | null
          session_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          agency_id: string | null
          base_salary_bs: number
          base_salary_usd: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          sunday_rate_usd: number
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          base_salary_bs?: number
          base_salary_usd?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sunday_rate_usd?: number
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          base_salary_bs?: number
          base_salary_usd?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sunday_rate_usd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      encargada_cuadre_details: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          lottery_system_id: string
          prizes_bs: number
          prizes_usd: number
          sales_bs: number
          sales_usd: number
          session_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          lottery_system_id: string
          prizes_bs?: number
          prizes_usd?: number
          sales_bs?: number
          sales_usd?: number
          session_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          lottery_system_id?: string
          prizes_bs?: number
          prizes_usd?: number
          sales_bs?: number
          sales_usd?: number
          session_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          agency_id: string | null
          amount_bs: number
          amount_usd: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          description: string
          id: string
          is_paid: boolean
          session_id: string | null
          transaction_date: string | null
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          amount_bs?: number
          amount_usd?: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          description: string
          id?: string
          is_paid?: boolean
          session_id?: string | null
          transaction_date?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          amount_bs?: number
          amount_usd?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          description?: string
          id?: string
          is_paid?: boolean
          session_id?: string | null
          transaction_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "daily_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      inter_agency_debts: {
        Row: {
          creditor_agency_id: string
          debtor_agency_id: string
          id: string
          last_updated: string
          total_debt_bs: number
          total_debt_usd: number
        }
        Insert: {
          creditor_agency_id: string
          debtor_agency_id: string
          id?: string
          last_updated?: string
          total_debt_bs?: number
          total_debt_usd?: number
        }
        Update: {
          creditor_agency_id?: string
          debtor_agency_id?: string
          id?: string
          last_updated?: string
          total_debt_bs?: number
          total_debt_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "inter_agency_debts_creditor_agency_id_fkey"
            columns: ["creditor_agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_agency_debts_debtor_agency_id_fkey"
            columns: ["debtor_agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      inter_agency_loans: {
        Row: {
          amount_bs: number
          amount_usd: number
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          from_agency_id: string
          id: string
          loan_date: string
          reason: string
          status: string
          to_agency_id: string
          updated_at: string
        }
        Insert: {
          amount_bs?: number
          amount_usd?: number
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          from_agency_id: string
          id?: string
          loan_date?: string
          reason: string
          status?: string
          to_agency_id: string
          updated_at?: string
        }
        Update: {
          amount_bs?: number
          amount_usd?: number
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          from_agency_id?: string
          id?: string
          loan_date?: string
          reason?: string
          status?: string
          to_agency_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inter_agency_loans_from_agency_id_fkey"
            columns: ["from_agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_agency_loans_to_agency_id_fkey"
            columns: ["to_agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      lottery_systems: {
        Row: {
          code: string
          created_at: string
          has_subcategories: boolean | null
          id: string
          is_active: boolean
          name: string
          parent_system_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          has_subcategories?: boolean | null
          id?: string
          is_active?: boolean
          name: string
          parent_system_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          has_subcategories?: boolean | null
          id?: string
          is_active?: boolean
          name?: string
          parent_system_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lottery_systems_parent_system_id_fkey"
            columns: ["parent_system_id"]
            isOneToOne: false
            referencedRelation: "lottery_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      mobile_payments: {
        Row: {
          agency_id: string | null
          amount_bs: number
          created_at: string
          description: string | null
          id: string
          reference_number: string
          session_id: string | null
          transaction_date: string | null
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          amount_bs?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_number: string
          session_id?: string | null
          transaction_date?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          amount_bs?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_number?: string
          session_id?: string | null
          transaction_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mobile_payments_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobile_payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "daily_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_prizes: {
        Row: {
          amount_bs: number
          created_at: string
          description: string | null
          id: string
          is_paid: boolean
          session_id: string
          updated_at: string
        }
        Insert: {
          amount_bs?: number
          created_at?: string
          description?: string | null
          id?: string
          is_paid?: boolean
          session_id: string
          updated_at?: string
        }
        Update: {
          amount_bs?: number
          created_at?: string
          description?: string | null
          id?: string
          is_paid?: boolean
          session_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      point_of_sale: {
        Row: {
          agency_id: string | null
          amount_bs: number
          created_at: string
          id: string
          session_id: string | null
          transaction_date: string | null
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          amount_bs?: number
          created_at?: string
          id?: string
          session_id?: string | null
          transaction_date?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          amount_bs?: number
          created_at?: string
          id?: string
          session_id?: string | null
          transaction_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_of_sale_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_of_sale_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "daily_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      prize_transactions: {
        Row: {
          amount_bs: number
          amount_usd: number
          created_at: string
          id: string
          lottery_system_id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          amount_bs?: number
          amount_usd?: number
          created_at?: string
          id?: string
          lottery_system_id: string
          session_id: string
          updated_at?: string
        }
        Update: {
          amount_bs?: number
          amount_usd?: number
          created_at?: string
          id?: string
          lottery_system_id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prize_transactions_lottery_system_id_fkey"
            columns: ["lottery_system_id"]
            isOneToOne: false
            referencedRelation: "lottery_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prize_transactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "daily_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          agency_id: string | null
          agency_name: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_id?: string | null
          agency_name?: string | null
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_id?: string | null
          agency_name?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_transactions: {
        Row: {
          amount_bs: number
          amount_usd: number
          created_at: string
          id: string
          lottery_system_id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          amount_bs?: number
          amount_usd?: number
          created_at?: string
          id?: string
          lottery_system_id: string
          session_id: string
          updated_at?: string
        }
        Update: {
          amount_bs?: number
          amount_usd?: number
          created_at?: string
          id?: string
          lottery_system_id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_transactions_lottery_system_id_fkey"
            columns: ["lottery_system_id"]
            isOneToOne: false
            referencedRelation: "lottery_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_transactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "daily_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      system_commission_rates: {
        Row: {
          commission_percentage: number
          commission_percentage_usd: number
          created_at: string
          id: string
          is_active: boolean
          lottery_system_id: string
          updated_at: string
          utility_percentage: number
          utility_percentage_usd: number
        }
        Insert: {
          commission_percentage?: number
          commission_percentage_usd?: number
          created_at?: string
          id?: string
          is_active?: boolean
          lottery_system_id: string
          updated_at?: string
          utility_percentage?: number
          utility_percentage_usd?: number
        }
        Update: {
          commission_percentage?: number
          commission_percentage_usd?: number
          created_at?: string
          id?: string
          is_active?: boolean
          lottery_system_id?: string
          updated_at?: string
          utility_percentage?: number
          utility_percentage_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "system_commission_rates_lottery_system_id_fkey"
            columns: ["lottery_system_id"]
            isOneToOne: true
            referencedRelation: "lottery_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_bank_expenses: {
        Row: {
          agency_id: string | null
          amount_bs: number
          amount_usd: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string
          description: string
          group_id: string | null
          id: string
          updated_at: string
          week_end_date: string
          week_start_date: string
        }
        Insert: {
          agency_id?: string | null
          amount_bs?: number
          amount_usd?: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by: string
          description: string
          group_id?: string | null
          id?: string
          updated_at?: string
          week_end_date: string
          week_start_date: string
        }
        Update: {
          agency_id?: string | null
          amount_bs?: number
          amount_usd?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string
          description?: string
          group_id?: string | null
          id?: string
          updated_at?: string
          week_end_date?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_bank_expenses_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_bank_expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "agency_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_cuadre_config: {
        Row: {
          additional_amount_bs: number
          additional_amount_usd: number
          additional_notes: string | null
          agency_id: string
          apply_excess_usd: boolean
          cash_available_bs: number
          cash_available_usd: number
          closure_notes: string | null
          created_at: string
          created_by: string
          excess_usd: number
          exchange_rate: number
          final_difference: number
          id: string
          updated_at: string
          week_end_date: string
          week_start_date: string
        }
        Insert: {
          additional_amount_bs?: number
          additional_amount_usd?: number
          additional_notes?: string | null
          agency_id: string
          apply_excess_usd?: boolean
          cash_available_bs?: number
          cash_available_usd?: number
          closure_notes?: string | null
          created_at?: string
          created_by: string
          excess_usd?: number
          exchange_rate?: number
          final_difference?: number
          id?: string
          updated_at?: string
          week_end_date: string
          week_start_date: string
        }
        Update: {
          additional_amount_bs?: number
          additional_amount_usd?: number
          additional_notes?: string | null
          agency_id?: string
          apply_excess_usd?: boolean
          cash_available_bs?: number
          cash_available_usd?: number
          closure_notes?: string | null
          created_at?: string
          created_by?: string
          excess_usd?: number
          exchange_rate?: number
          final_difference?: number
          id?: string
          updated_at?: string
          week_end_date?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_cuadre_config_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_payroll: {
        Row: {
          absences_deductions: number
          bonuses_extras: number
          created_at: string
          employee_id: string
          exchange_rate: number
          id: string
          notes: string | null
          other_deductions: number
          sunday_payment: number
          total_bs: number
          total_usd: number
          updated_at: string
          week_end_date: string
          week_start_date: string
          weekly_base_salary: number
        }
        Insert: {
          absences_deductions?: number
          bonuses_extras?: number
          created_at?: string
          employee_id: string
          exchange_rate?: number
          id?: string
          notes?: string | null
          other_deductions?: number
          sunday_payment?: number
          total_bs?: number
          total_usd?: number
          updated_at?: string
          week_end_date: string
          week_start_date: string
          weekly_base_salary?: number
        }
        Update: {
          absences_deductions?: number
          bonuses_extras?: number
          created_at?: string
          employee_id?: string
          exchange_rate?: number
          id?: string
          notes?: string | null
          other_deductions?: number
          sunday_payment?: number
          total_bs?: number
          total_usd?: number
          updated_at?: string
          week_end_date?: string
          week_start_date?: string
          weekly_base_salary?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_payroll_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: { max_per_hour?: number; operation_type: string }
        Returns: boolean
      }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_current_week_boundaries: {
        Args: never
        Returns: {
          week_end: string
          week_number: number
          week_start: string
          year: number
        }[]
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_user_role_from_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_security_event: {
        Args: {
          p_details?: Json
          p_event_type: string
          p_ip_address?: unknown
          p_user_agent?: string
          p_user_id: string
        }
        Returns: undefined
      }
      user_owns_session: { Args: { session_id: string }; Returns: boolean }
      validate_password_strength: {
        Args: { password: string }
        Returns: boolean
      }
      venezuela_now: { Args: never; Returns: string }
    }
    Enums: {
      expense_category: "deuda" | "gasto_operativo" | "otros"
      user_role: "taquillero" | "encargado" | "administrador" | "encargada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      expense_category: ["deuda", "gasto_operativo", "otros"],
      user_role: ["taquillero", "encargado", "administrador", "encargada"],
    },
  },
} as const
