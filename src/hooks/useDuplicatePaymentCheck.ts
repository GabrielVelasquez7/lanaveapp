import { supabase } from '@/integrations/supabase/client';

export interface DuplicatePaymentInfo {
  id: string;
  reference_number: string;
  amount_bs: number;
  description: string | null;
  transaction_date: string | null;
  agency_name: string | null;
  agency_id: string | null;
  session_user_name: string | null;
}

/**
 * Check if a reference number already exists in mobile_payments.
 * Returns info about the existing payment if found, null otherwise.
 */
export async function checkDuplicateReference(
  referenceNumber: string
): Promise<DuplicatePaymentInfo | null> {
  if (!referenceNumber || referenceNumber.trim().length === 0) return null;

  const { data, error } = await supabase
    .from('mobile_payments')
    .select(`
      id,
      reference_number,
      amount_bs,
      description,
      transaction_date,
      agency_id,
      session_id
    `)
    .eq('reference_number', referenceNumber.trim())
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  // Try to get agency name
  let agencyName: string | null = null;
  if (data.agency_id) {
    const { data: agency } = await supabase
      .from('agencies')
      .select('name')
      .eq('id', data.agency_id)
      .maybeSingle();
    agencyName = agency?.name || null;
  }

  // Try to get user name from session
  let sessionUserName: string | null = null;
  if (data.session_id) {
    const { data: session } = await supabase
      .from('daily_sessions')
      .select('user_id')
      .eq('id', data.session_id)
      .maybeSingle();

    if (session?.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, agency_id')
        .eq('user_id', session.user_id)
        .maybeSingle();

      sessionUserName = profile?.full_name || null;

      // If no agency from payment, try from profile
      if (!agencyName && profile?.agency_id) {
        const { data: agency } = await supabase
          .from('agencies')
          .select('name')
          .eq('id', profile.agency_id)
          .maybeSingle();
        agencyName = agency?.name || null;
      }
    }
  }

  return {
    id: data.id,
    reference_number: data.reference_number,
    amount_bs: data.amount_bs,
    description: data.description,
    transaction_date: data.transaction_date,
    agency_name: agencyName,
    agency_id: data.agency_id,
    session_user_name: sessionUserName,
  };
}

/**
 * Format a human-readable message about a duplicate payment.
 */
export function formatDuplicateMessage(info: DuplicatePaymentInfo): string {
  const parts: string[] = [];

  const type = info.amount_bs >= 0 ? 'Recibido' : 'Pagado';
  parts.push(`Tipo: ${type}`);

  parts.push(
    `Monto: ${Math.abs(info.amount_bs).toLocaleString('es-VE', {
      style: 'currency',
      currency: 'VES',
      minimumFractionDigits: 2,
    })}`
  );

  if (info.agency_name) {
    parts.push(`Agencia: ${info.agency_name}`);
  }

  if (info.session_user_name) {
    parts.push(`Registrado por: ${info.session_user_name}`);
  }

  if (info.transaction_date) {
    const [y, m, d] = info.transaction_date.split('-');
    parts.push(`Fecha: ${d}/${m}/${y}`);
  }

  if (info.description) {
    const cleanDesc = info.description
      .replace('[RECIBIDO] ', '')
      .replace('[PAGADO] ', '')
      .replace('[RECIBIDO]', '')
      .replace('[PAGADO]', '')
      .trim();
    if (cleanDesc) {
      parts.push(`Descripción: ${cleanDesc}`);
    }
  }

  return parts.join(' | ');
}
