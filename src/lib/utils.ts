import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | undefined | null, currency: 'VES' | 'USD' = 'VES'): string {
  const safeAmount = Number(amount) || 0;
  if (currency === 'VES') {
    // Venezuelan format: Bs 1.000,00
    return `Bs ${safeAmount.toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  } else {
    // USD format: $1,000.00
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return formatter.format(safeAmount);
  }
}
