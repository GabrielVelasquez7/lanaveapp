// Datos ficticios para el modo demo

export const demoLotterySystems = [
  { id: 'demo-sys-001', name: 'Chance Animalitos', code: 'CHA', is_active: true },
  { id: 'demo-sys-002', name: 'Lotto Activo', code: 'LAC', is_active: true },
  { id: 'demo-sys-003', name: 'Triple Gordo', code: 'TGO', is_active: true },
  { id: 'demo-sys-004', name: 'La Granjita', code: 'LGR', is_active: true },
  { id: 'demo-sys-005', name: 'Guacharo Activo', code: 'GAC', is_active: true },
];

export const demoAgencies = [
  { id: 'demo-agency-001', name: 'Agencia Demo Central', is_active: true, address: 'Av. Principal 123' },
  { id: 'demo-agency-002', name: 'Agencia Demo Norte', is_active: true, address: 'Calle Norte 456' },
  { id: 'demo-agency-003', name: 'Agencia Demo Sur', is_active: true, address: 'Av. Sur 789' },
];

export const demoClients = [
  { id: 'demo-client-001', name: 'Cliente Ejemplo 1', is_active: true },
  { id: 'demo-client-002', name: 'Cliente Ejemplo 2', is_active: true },
  { id: 'demo-client-003', name: 'Cliente Ejemplo 3', is_active: true },
];

export const demoUsers = [
  { id: 'demo-user-001', full_name: 'Ana García', role: 'taquillero', agency_name: 'Agencia Demo Central', is_active: true },
  { id: 'demo-user-002', full_name: 'Pedro López', role: 'taquillero', agency_name: 'Agencia Demo Norte', is_active: true },
  { id: 'demo-user-003', full_name: 'María Rodríguez', role: 'encargada', agency_name: 'Agencia Demo Central', is_active: true },
];

export const demoEmployees = [
  { id: 'demo-emp-001', name: 'Rosa Martínez', base_salary_bs: 500, base_salary_usd: 50, is_active: true },
  { id: 'demo-emp-002', name: 'Carlos Pérez', base_salary_bs: 450, base_salary_usd: 45, is_active: true },
  { id: 'demo-emp-003', name: 'Laura Gómez', base_salary_bs: 480, base_salary_usd: 48, is_active: true },
];

// Datos de transacciones ficticias para el taquillero
export const demoSalesTransactions = [
  { lottery_system_id: 'demo-sys-001', lottery_system_name: 'Chance Animalitos', sales_bs: 15000, sales_usd: 120, prizes_bs: 5000, prizes_usd: 40 },
  { lottery_system_id: 'demo-sys-002', lottery_system_name: 'Lotto Activo', sales_bs: 12000, sales_usd: 95, prizes_bs: 3500, prizes_usd: 28 },
  { lottery_system_id: 'demo-sys-003', lottery_system_name: 'Triple Gordo', sales_bs: 8500, sales_usd: 68, prizes_bs: 2000, prizes_usd: 16 },
  { lottery_system_id: 'demo-sys-004', lottery_system_name: 'La Granjita', sales_bs: 6200, sales_usd: 50, prizes_bs: 1500, prizes_usd: 12 },
  { lottery_system_id: 'demo-sys-005', lottery_system_name: 'Guacharo Activo', sales_bs: 4800, sales_usd: 38, prizes_bs: 800, prizes_usd: 6 },
];

export const demoExpenses = [
  { id: 'demo-exp-001', description: 'Papel para impresora', amount_bs: 150, amount_usd: 0, category: 'gasto_operativo' },
  { id: 'demo-exp-002', description: 'Transporte', amount_bs: 80, amount_usd: 0, category: 'gasto_operativo' },
  { id: 'demo-exp-003', description: 'Refrigerios', amount_bs: 120, amount_usd: 0, category: 'otros' },
];

export const demoMobilePayments = [
  { id: 'demo-mp-001', reference_number: '1234567890', amount_bs: 500, description: 'Pago cliente A' },
  { id: 'demo-mp-002', reference_number: '0987654321', amount_bs: 750, description: 'Pago cliente B' },
];

export const demoPendingPrizes = [
  { id: 'demo-pp-001', amount_bs: 2500, description: 'Premio pendiente - Ticket #12345', is_paid: false },
  { id: 'demo-pp-002', amount_bs: 1800, description: 'Premio pendiente - Ticket #67890', is_paid: false },
];

// Resumen de cuadre diario demo
export const demoDailyCuadreSummary = {
  total_sales_bs: 46500,
  total_sales_usd: 371,
  total_prizes_bs: 12800,
  total_prizes_usd: 102,
  total_expenses_bs: 350,
  total_expenses_usd: 0,
  total_mobile_payments_bs: 1250,
  total_pos_bs: 800,
  cash_available_bs: 32100,
  cash_available_usd: 269,
  balance_bs: 32100,
  exchange_rate: 36.5,
  pending_prizes: 4300,
  encargada_status: null,
  is_closed: false,
};

// Datos semanales para encargada
export const demoWeeklySummary = {
  week_start: '2024-01-08',
  week_end: '2024-01-14',
  agencies: [
    {
      agency_id: 'demo-agency-001',
      agency_name: 'Agencia Demo Central',
      total_sales_bs: 185000,
      total_sales_usd: 1480,
      total_prizes_bs: 52000,
      total_prizes_usd: 416,
      total_expenses_bs: 2800,
      total_expenses_usd: 0,
      balance_bs: 130200,
      cash_available_bs: 125000,
      cash_available_usd: 1064,
    },
    {
      agency_id: 'demo-agency-002',
      agency_name: 'Agencia Demo Norte',
      total_sales_bs: 142000,
      total_sales_usd: 1136,
      total_prizes_bs: 38500,
      total_prizes_usd: 308,
      total_expenses_bs: 2100,
      total_expenses_usd: 0,
      balance_bs: 101400,
      cash_available_bs: 98000,
      cash_available_usd: 828,
    },
  ],
};

// Datos de cuadres diarios para revisión de encargada
export const demoDailyCuadres = [
  {
    id: 'demo-cuadre-001',
    session_date: '2024-01-14',
    user_name: 'Ana García',
    agency_name: 'Agencia Demo Central',
    total_sales_bs: 28500,
    total_sales_usd: 228,
    total_prizes_bs: 8200,
    total_prizes_usd: 66,
    balance_bs: 19450,
    encargada_status: 'pendiente',
    is_closed: true,
  },
  {
    id: 'demo-cuadre-002',
    session_date: '2024-01-14',
    user_name: 'Pedro López',
    agency_name: 'Agencia Demo Norte',
    total_sales_bs: 22000,
    total_sales_usd: 176,
    total_prizes_bs: 5800,
    total_prizes_usd: 46,
    balance_bs: 15400,
    encargada_status: 'aprobado',
    is_closed: true,
  },
];

// Resumen por sistemas para admin
export const demoSystemsSummary = [
  {
    system_id: 'demo-sys-001',
    system_name: 'Chance Animalitos',
    total_sales_bs: 85000,
    total_sales_usd: 680,
    total_prizes_bs: 25500,
    total_prizes_usd: 204,
    commission_percentage: 15,
    utility_bs: 8925,
    utility_usd: 71.4,
  },
  {
    system_id: 'demo-sys-002',
    system_name: 'Lotto Activo',
    total_sales_bs: 68000,
    total_sales_usd: 544,
    total_prizes_bs: 18700,
    total_prizes_usd: 150,
    commission_percentage: 12,
    utility_bs: 5916,
    utility_usd: 47.28,
  },
  {
    system_id: 'demo-sys-003',
    system_name: 'Triple Gordo',
    total_sales_bs: 52000,
    total_sales_usd: 416,
    total_prizes_bs: 14300,
    total_prizes_usd: 114,
    commission_percentage: 10,
    utility_bs: 3770,
    utility_usd: 30.2,
  },
];

// Datos de banqueo para admin
export const demoBanqueoData = [
  {
    client_id: 'demo-client-001',
    client_name: 'Cliente Ejemplo 1',
    week_start: '2024-01-08',
    week_end: '2024-01-14',
    sales_bs: 45000,
    sales_usd: 360,
    prizes_bs: 12500,
    prizes_usd: 100,
    participation_percentage: 50,
    paid_bs: true,
    paid_usd: false,
  },
  {
    client_id: 'demo-client-002',
    client_name: 'Cliente Ejemplo 2',
    week_start: '2024-01-08',
    week_end: '2024-01-14',
    sales_bs: 38000,
    sales_usd: 304,
    prizes_bs: 9800,
    prizes_usd: 78,
    participation_percentage: 40,
    paid_bs: false,
    paid_usd: false,
  },
];

// Préstamos entre agencias demo
export const demoInterAgencyLoans = [
  {
    id: 'demo-loan-001',
    from_agency_name: 'Agencia Demo Central',
    to_agency_name: 'Agencia Demo Norte',
    amount_bs: 5000,
    amount_usd: 0,
    reason: 'Préstamo para cambio',
    status: 'pendiente',
    loan_date: '2024-01-12',
  },
];

// Nómina semanal demo
export const demoWeeklyPayroll = [
  {
    id: 'demo-payroll-001',
    employee_name: 'Rosa Martínez',
    weekly_base_salary: 500,
    bonuses_extras: 50,
    absences_deductions: 0,
    other_deductions: 0,
    sunday_payment: 25,
    total_bs: 575,
    total_usd: 57.5,
  },
  {
    id: 'demo-payroll-002',
    employee_name: 'Carlos Pérez',
    weekly_base_salary: 450,
    bonuses_extras: 30,
    absences_deductions: 45,
    other_deductions: 0,
    sunday_payment: 22.5,
    total_bs: 457.5,
    total_usd: 45.75,
  },
];

// Gastos fijos semanales demo
export const demoWeeklyExpenses = [
  { id: 'demo-wexp-001', description: 'Alquiler local', amount_bs: 2500, amount_usd: 250, category: 'gasto_operativo' },
  { id: 'demo-wexp-002', description: 'Servicios (luz, agua)', amount_bs: 800, amount_usd: 0, category: 'gasto_operativo' },
  { id: 'demo-wexp-003', description: 'Internet y teléfono', amount_bs: 350, amount_usd: 35, category: 'gasto_operativo' },
];

// Comisiones por sistema demo
export const demoSystemCommissions = [
  { id: 'demo-comm-001', lottery_system_id: 'demo-sys-001', system_name: 'Chance Animalitos', commission_percentage: 15, utility_percentage: 10 },
  { id: 'demo-comm-002', lottery_system_id: 'demo-sys-002', system_name: 'Lotto Activo', commission_percentage: 12, utility_percentage: 8 },
  { id: 'demo-comm-003', lottery_system_id: 'demo-sys-003', system_name: 'Triple Gordo', commission_percentage: 10, utility_percentage: 7 },
  { id: 'demo-comm-004', lottery_system_id: 'demo-sys-004', system_name: 'La Granjita', commission_percentage: 14, utility_percentage: 9 },
  { id: 'demo-comm-005', lottery_system_id: 'demo-sys-005', system_name: 'Guacharo Activo', commission_percentage: 11, utility_percentage: 7 },
];
