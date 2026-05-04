import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface PosBank {
  id: string;
  name: string;
  variable_percentage: number;
  monthly_fixed_usd: number;
  is_active: boolean;
}

export interface AgencyPosBank {
  id: string;
  agency_id: string;
  bank_id: string;
  is_active: boolean;
}

export interface CommissionRow {
  agency_id: string;
  agency_name: string;
  bank_id: string;
  bank_name: string;
  variable_percentage: number;
  monthly_fixed_usd: number;
  sales_bs: number;
  variable_amount_bs: number;
  fixed_amount_bs: number;
  total_bs: number;
  needs_split: boolean;
}

export const posCommissionsService = {
  async fetchBanks() {
    const { data, error } = await supabase
      .from('pos_banks' as any)
      .select('*')
      .order('name');
    if (error) throw error;
    return (data || []) as unknown as PosBank[];
  },

  async fetchAssignments() {
    const { data, error } = await supabase
      .from('agency_pos_banks' as any)
      .select('*');
    if (error) throw error;
    return (data || []) as unknown as AgencyPosBank[];
  },

  async fetchSplits(weekStart: Date) {
    const startStr = format(weekStart, 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('weekly_pos_split' as any)
      .select('*')
      .eq('week_start_date', startStr);
    if (error) throw error;
    return (data || []) as any[];
  },

  async fetchPosTotalsByAgency(weekStart: Date, weekEnd: Date) {
    const startStr = format(weekStart, 'yyyy-MM-dd');
    const endStr = format(weekEnd, 'yyyy-MM-dd');
    // Sum point_of_sale.amount_bs grouped by agency for the week
    const { data, error } = await supabase
      .from('point_of_sale')
      .select('agency_id, amount_bs, transaction_date')
      .gte('transaction_date', startStr)
      .lte('transaction_date', endStr);
    if (error) throw error;
    const totals = new Map<string, number>();
    (data || []).forEach((row: any) => {
      if (!row.agency_id) return;
      totals.set(row.agency_id, (totals.get(row.agency_id) || 0) + Number(row.amount_bs || 0));
    });
    return totals;
  },

  async fetchExistingCommissions(weekStart: Date) {
    const startStr = format(weekStart, 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('weekly_pos_commissions' as any)
      .select('*')
      .eq('week_start_date', startStr);
    if (error) throw error;
    return (data || []) as any[];
  },

  async fetchSuggestedBcv(weekStart: Date) {
    const startStr = format(weekStart, 'yyyy-MM-dd');
    const { data } = await supabase
      .from('weekly_cuadre_config')
      .select('exchange_rate')
      .eq('week_start_date', startStr)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.exchange_rate ? Number(data.exchange_rate) : null;
  },

  async upsertSplit(params: {
    agency_id: string;
    bank_id: string;
    week_start: Date;
    week_end: Date;
    sales_bs: number;
    user_id: string;
  }) {
    const startStr = format(params.week_start, 'yyyy-MM-dd');
    const endStr = format(params.week_end, 'yyyy-MM-dd');
    const { error } = await supabase
      .from('weekly_pos_split' as any)
      .upsert(
        {
          agency_id: params.agency_id,
          bank_id: params.bank_id,
          week_start_date: startStr,
          week_end_date: endStr,
          sales_bs: params.sales_bs,
          created_by: params.user_id,
        },
        { onConflict: 'agency_id,bank_id,week_start_date' }
      );
    if (error) throw error;
  },

  /**
   * Generates/regenerates POS commission expenses for the given week.
   * Creates one weekly_bank_expenses row per (agency, bank) and tracks history in weekly_pos_commissions.
   */
  async generateCommissions(params: {
    weekStart: Date;
    weekEnd: Date;
    bcvRate: number;
    rows: CommissionRow[];
    userId: string;
  }) {
    const startStr = format(params.weekStart, 'yyyy-MM-dd');
    const endStr = format(params.weekEnd, 'yyyy-MM-dd');

    // Remove previous auto-generated POS commission expenses for this week
    // Identified by description prefix
    await supabase
      .from('weekly_bank_expenses')
      .delete()
      .eq('week_start_date', startStr)
      .eq('week_end_date', endStr)
      .like('description', 'Comisión POS %');

    // Remove previous commission audit rows for the week
    await supabase
      .from('weekly_pos_commissions' as any)
      .delete()
      .eq('week_start_date', startStr);

    if (params.rows.length === 0) return { inserted: 0 };

    // Insert new weekly_bank_expenses
    const expenseRows = params.rows.map((r) => ({
      group_id: null,
      agency_id: r.agency_id,
      week_start_date: startStr,
      week_end_date: endStr,
      category: 'otros' as const,
      description: `Comisión POS ${r.bank_name} - ${r.agency_name}`,
      amount_bs: r.total_bs,
      amount_usd: 0,
      created_by: params.userId,
    }));

    const { data: insertedExpenses, error: expErr } = await supabase
      .from('weekly_bank_expenses')
      .insert(expenseRows)
      .select('id, agency_id, description');
    if (expErr) throw expErr;

    // Map back to commissions for FK reference
    const auditRows = params.rows.map((r) => {
      const matched = (insertedExpenses || []).find(
        (e: any) => e.agency_id === r.agency_id && e.description === `Comisión POS ${r.bank_name} - ${r.agency_name}`
      );
      return {
        agency_id: r.agency_id,
        bank_id: r.bank_id,
        week_start_date: startStr,
        week_end_date: endStr,
        sales_bs: r.sales_bs,
        variable_percentage: r.variable_percentage,
        variable_amount_bs: r.variable_amount_bs,
        monthly_fixed_usd: r.monthly_fixed_usd,
        fixed_amount_bs: r.fixed_amount_bs,
        total_bs: r.total_bs,
        bcv_rate: params.bcvRate,
        weekly_bank_expense_id: matched?.id || null,
        generated_by: params.userId,
      };
    });

    const { error: auditErr } = await supabase
      .from('weekly_pos_commissions' as any)
      .insert(auditRows);
    if (auditErr) throw auditErr;

    return { inserted: expenseRows.length };
  },

  /**
   * Computes live POS commissions for a given week dynamically.
   * If an agency has multiple banks but is missing a split, its commission is $0.
   */
  async getLiveCommissionsForWeek(weekStart: Date, weekEnd: Date): Promise<CommissionRow[]> {
    const [banks, agenciesRes, assignments, splitsData, posTotals, bcvRate] = await Promise.all([
      this.fetchBanks(),
      supabase.from('agencies').select('id, name').eq('is_active', true),
      this.fetchAssignments(),
      this.fetchSplits(weekStart),
      this.fetchPosTotalsByAgency(weekStart, weekEnd),
      this.fetchSuggestedBcv(weekStart),
    ]);

    const agencies = agenciesRes.data || [];
    const splits: Record<string, number> = {};
    splitsData.forEach((s: any) => { splits[`${s.agency_id}_${s.bank_id}`] = Number(s.sales_bs); });
    const bcv = Number(bcvRate) || 0; // Si no hay tasa configurada, la comisión fija queda en 0

    const rows: CommissionRow[] = [];
    const byAgency = new Map<string, string[]>();
    assignments.filter(a => a.is_active).forEach((a) => {
      if (!byAgency.has(a.agency_id)) byAgency.set(a.agency_id, []);
      byAgency.get(a.agency_id)!.push(a.bank_id);
    });

    byAgency.forEach((bankIds, agencyId) => {
      const agency = agencies.find((a: any) => a.id === agencyId);
      if (!agency) return;
      const totalPos = posTotals.get(agencyId) || 0;
      const isMulti = bankIds.length > 1;

      bankIds.forEach((bankId) => {
        const bank = banks.find((b) => b.id === bankId);
        if (!bank) return;
        let salesBs = 0;
        let needsSplit = false;
        
        if (isMulti) {
          const splitVal = splits[`${agencyId}_${bankId}`];
          if (splitVal === undefined) {
            needsSplit = true;
            salesBs = 0; // Dejar en 0 si falta el split
          } else {
            salesBs = splitVal || 0;
          }
        } else {
          salesBs = totalPos;
        }

        // Si falta split, la comision queda en 0. Si no, calcular normalmente.
        const c = needsSplit ? { variable_amount_bs: 0, fixed_amount_bs: 0, total_bs: 0 } : calcCommission({
          salesBs,
          variablePercentage: Number(bank.variable_percentage),
          monthlyFixedUsd: Number(bank.monthly_fixed_usd),
          bcvRate: bcv,
        });

        rows.push({
          agency_id: agencyId,
          agency_name: agency.name,
          bank_id: bankId,
          bank_name: bank.name,
          variable_percentage: Number(bank.variable_percentage),
          monthly_fixed_usd: Number(bank.monthly_fixed_usd),
          sales_bs: salesBs,
          variable_amount_bs: c.variable_amount_bs,
          fixed_amount_bs: c.fixed_amount_bs,
          total_bs: c.total_bs,
          needs_split: needsSplit,
        });
      });
    });

    return rows.sort((a, b) => a.agency_name.localeCompare(b.agency_name) || a.bank_name.localeCompare(b.bank_name));
  },
};

/**
 * Pure calc: returns amount in Bs for variable + fixed components.
 * Fixed = monthly_fixed_usd * bcv / 4
 * Variable = sales_bs * variable_percentage / 100
 */
export function calcCommission(params: {
  salesBs: number;
  variablePercentage: number;
  monthlyFixedUsd: number;
  bcvRate: number;
}) {
  const variable = (Number(params.salesBs) || 0) * (Number(params.variablePercentage) || 0) / 100;
  const fixed = ((Number(params.monthlyFixedUsd) || 0) * (Number(params.bcvRate) || 0)) / 4;
  const total = variable + fixed;
  return {
    variable_amount_bs: Math.round(variable * 100) / 100,
    fixed_amount_bs: Math.round(fixed * 100) / 100,
    total_bs: Math.round(total * 100) / 100,
  };
}