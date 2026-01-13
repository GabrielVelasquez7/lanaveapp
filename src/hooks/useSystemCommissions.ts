import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CommissionRate {
  id: string;
  lottery_system_id: string;
  commission_percentage: number;
  utility_percentage: number;
  commission_percentage_usd: number;
  utility_percentage_usd: number;
  is_active: boolean;
}

export const useSystemCommissions = () => {
  const [commissions, setCommissions] = useState<Map<string, CommissionRate>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCommissions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Only fetch commissions for ACTIVE systems
      // This ensures that if a system is deactivated, its commissions won't be used
      const { data, error: fetchError } = await supabase
        .from("system_commission_rates")
        .select("*, lottery_systems!inner(id, is_active)")
        .eq("is_active", true)
        .eq("lottery_systems.is_active", true);

      if (fetchError) throw fetchError;

      const commissionsMap = new Map<string, CommissionRate>();
      data?.forEach((rate) => {
        commissionsMap.set(rate.lottery_system_id, {
          id: rate.id,
          lottery_system_id: rate.lottery_system_id,
          commission_percentage: rate.commission_percentage,
          utility_percentage: rate.utility_percentage,
          commission_percentage_usd: rate.commission_percentage_usd,
          utility_percentage_usd: rate.utility_percentage_usd,
          is_active: rate.is_active,
        });
      });

      setCommissions(commissionsMap);
    } catch (err) {
      console.error("Error fetching system commissions:", err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommissions();
  }, []);

  return {
    commissions,
    loading,
    error,
    refetch: fetchCommissions,
  };
};
