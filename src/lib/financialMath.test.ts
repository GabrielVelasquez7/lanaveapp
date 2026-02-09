import { describe, it, expect } from 'vitest';
import { calculateCuadreTotals } from './financialMath';

describe('Financial Logic - calculateCuadreTotals', () => {

    // Default zero input helper
    const baseInput = {
        totalSales: { bs: 0, usd: 0 },
        totalPrizes: { bs: 0, usd: 0 },
        totalGastos: { bs: 0, usd: 0 },
        totalDeudas: { bs: 0, usd: 0 },
        pagoMovilRecibidos: 0,
        pagoMovilPagados: 0,
        totalPointOfSale: 0,
        cashAvailable: 0,
        cashAvailableUsd: 0,
        pendingPrizes: 0,
        pendingPrizesUsd: 0,
        additionalAmountBs: 0,
        additionalAmountUsd: 0,
        exchangeRate: 50, // Easy math
        applyExcessUsd: true
    };

    it('should return perfect balance when sales equal cash', () => {
        const input = {
            ...baseInput,
            totalSales: { bs: 1000, usd: 0 },
            cashAvailable: 1000
        };
        const result = calculateCuadreTotals(input);

        expect(result.cuadreVentasPremios.bs).toBe(1000); // 1000 - 0
        expect(result.sumatoriaBolivares).toBe(1000);
        expect(result.diferenciaFinal).toBe(0);
        expect(result.isBalanced).toBe(true);
    });

    it('should detect missing money in Bs', () => {
        const input = {
            ...baseInput,
            totalSales: { bs: 1000, usd: 0 },
            cashAvailable: 800 // 200 missing
        };
        const result = calculateCuadreTotals(input);

        expect(result.diferenciaFinal).toBe(-200);
        expect(result.isBalanced).toBe(false); // > 100 tolerance
    });

    it('should apply excess USD to cover Bs deficit', () => {
        const input = {
            ...baseInput,
            totalSales: { bs: 1000, usd: 0 },
            cashAvailable: 0, // 1000 Bs missing

            // USD Surplus
            // Let's say we have 0 sales in USD, but 20 USD cash extra
            cashAvailableUsd: 20,
            exchangeRate: 50
        };
        // 20 USD * 50 = 1000 Bs. Should cover the 1000 Bs missing from sales.

        const result = calculateCuadreTotals(input);

        expect(result.sumatoriaUsd).toBe(20);
        expect(result.diferenciaFinalUsd).toBe(20); // 20 - 0
        expect(result.excessUsd).toBe(20);
        expect(result.excessUsdInBs).toBe(1000);

        // Bs Side
        // Sumatoria = Cash(0) + Excess(1000) = 1000
        // Expected = Sales(1000)
        // Diff = 0
        expect(result.diferenciaFinal).toBe(0);
    });

    it('should NOT apply excess USD if toggle is off', () => {
        const input = {
            ...baseInput,
            totalSales: { bs: 1000, usd: 0 },
            cashAvailable: 0,
            cashAvailableUsd: 20,
            exchangeRate: 50,
            applyExcessUsd: false // Disabled
        };

        const result = calculateCuadreTotals(input);

        expect(result.excessUsd).toBe(0); // Should be considered 0 for conversion
        expect(result.excessUsdInBs).toBe(0);
        expect(result.diferenciaFinal).toBe(-1000); // Deficit remains
    });

    it('should handle pending prizes logic correctly', () => {
        // Sales: 1000. Cash: 1000. Pending Prize: 100.
        // If I have 1000 cash, and I owe 100.
        // DiffCierre = 1000 - 1000 = 0.
        // DiffFinal = 0 - 100 = -100.
        // This implies I should have KEPT 100 extra (so 1100 total) to pay the prize later?

        const input = {
            ...baseInput,
            totalSales: { bs: 1000, usd: 0 },
            cashAvailable: 1000,
            pendingPrizes: 100
        };

        const result = calculateCuadreTotals(input);
        expect(result.diferenciaFinal).toBe(-100);
        expect(result.isBalanced).toBe(true); // 100 is within tolerance
    });

});
