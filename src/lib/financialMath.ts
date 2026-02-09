interface FinancialInput {
    totalSales: { bs: number; usd: number };
    totalPrizes: { bs: number; usd: number };
    totalGastos: { bs: number; usd: number };
    totalDeudas: { bs: number; usd: number };
    pagoMovilRecibidos: number;
    pagoMovilPagados: number; // Positive value
    totalPointOfSale: number;

    cashAvailable: number;
    cashAvailableUsd: number;

    pendingPrizes: number; // Bs
    pendingPrizesUsd: number; // USD

    additionalAmountBs: number;
    additionalAmountUsd: number;

    exchangeRate: number;
    applyExcessUsd: boolean; // Toggle for converting excess USD to Bs
}

interface FinancialResult {
    cuadreVentasPremios: { bs: number; usd: number };
    totalBanco: number;
    sumatoriaUsd: number;
    diferenciaFinalUsd: number;
    sumatoriaBolivares: number;
    diferenciaCierre: number;
    diferenciaFinal: number; // Bs Final Difference (after pending prizes)
    excessUsd: number;
    excessUsdInBs: number;
    isBalanced: boolean;
}

/**
 * Pure function to calculate daily closure totals.
 * This logic is used by both Taquilleras and Encargadas.
 */
export function calculateCuadreTotals(input: FinancialInput): FinancialResult {
    const {
        totalSales, totalPrizes, totalGastos, totalDeudas,
        pagoMovilRecibidos, pagoMovilPagados, totalPointOfSale,
        cashAvailable, cashAvailableUsd,
        pendingPrizes, pendingPrizesUsd,
        additionalAmountBs, additionalAmountUsd,
        exchangeRate, applyExcessUsd
    } = input;

    // 1. Expected Balance (System View)
    // Cuadre = Ventas - Premios
    const cuadreVentasPremios = {
        bs: totalSales.bs - totalPrizes.bs,
        usd: totalSales.usd - totalPrizes.usd
    };

    // 2. Physical Count (Users Input + Bank)
    const totalBanco = pagoMovilRecibidos + totalPointOfSale - pagoMovilPagados;

    // --- USD Calculation ---
    // Sumatoria USD = Cash + Deudas + Gastos
    const sumatoriaUsd = cashAvailableUsd + totalDeudas.usd + totalGastos.usd;

    // Initial Difference USD = Sumatoria - Expected - Additional - Pending(USD)
    // Note: Pending Prizes in USD are subtracted from the expected balance because they are "owed" but not paid out yet? 
    // Logic from previous code: diferenciaFinalUsd = sumatoriaUsd - cuadreVentasPremiosUsd - addUsd - premiosPorPagarUsd;
    // Wait, if pending prizes are NOT paid, they should remain as cash?
    // Let's stick to the exact logic from previous implementation first to ensure regression safety.

    const diferenciaFinalUsd = sumatoriaUsd - cuadreVentasPremios.usd - additionalAmountUsd - pendingPrizesUsd;

    // Excess USD Logic
    // Only positive difference in USD is considered "excess" that can be converted to Bs if enabled.
    const excessUsd = (diferenciaFinalUsd > 0) ? diferenciaFinalUsd : 0;
    const excessUsdInBs = applyExcessUsd ? (excessUsd * exchangeRate) : 0;

    // --- BS Calculation ---
    // Sumatoria Bs = Cash + Bank + Deudas + Gastos + ExcessUSD(converted) - Additional
    // Note: Additional Bs is subtracted (it's money added from outside the system sales, so we remove it to see real balance? Or is it money spent elsewhere?
    // In previous code: sumatoriaBs = cashBs + totalBanco + ... + excess - addBs;
    // Usually "Additional" means money put IN to cover a deficit. So we subtract it from the physical count? 
    // Wait, if I put money IN, my physical count goes UP. To see if sales match, I must subtract that extra money. Correct.

    const sumatoriaBolivares = cashAvailable + totalBanco + totalDeudas.bs + totalGastos.bs + excessUsdInBs - additionalAmountBs;

    // Difference before pending prizes
    const diferenciaCierre = sumatoriaBolivares - cuadreVentasPremios.bs;

    // Final Difference (subtracting pending prizes in Bs)
    // If I have a pending prize, I should HAVE the money for it? 
    // Previous logic: diferenciaFinalBs = diferenciaCierre - cuadre.premiosPorPagar;
    // If I have 100 profit, and 20 pending prize. Result is 80? 
    // Or does pending mean I haven't paid it yet, so I should still have the money?
    // If I strictly follow: Real Money - (Sales - PrizesPaid).
    // If a prize is pending, it is NOT in PrizesPaid (usually transaction tables only have paid ones).
    // So Sales - PrizesPaid includes the money for the pending prize. 
    // So my Real Money SHOULD include that amount.
    // If I subtract pendingPrizes, what am I calculating? "Free Profit"? 
    // Let's assume the previous logic: `diferenciaCierre - pendingBs` is the target metric.

    const diferenciaFinal = diferenciaCierre - pendingPrizes;

    return {
        cuadreVentasPremios,
        totalBanco,
        sumatoriaUsd,
        diferenciaFinalUsd,
        sumatoriaBolivares,
        diferenciaCierre,
        diferenciaFinal,
        excessUsd,
        excessUsdInBs,
        isBalanced: Math.abs(diferenciaFinal) <= 100 // Tolerance of 100 Bs
    };
}
