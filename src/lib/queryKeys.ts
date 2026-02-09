export const queryKeys = {
    // Session related
    session: (userId: string | undefined, date: string) => ['session', userId, date] as const,
    sessionDetails: (sessionId: string | undefined) => ['session-details', sessionId] as const,

    // Transaction related
    sales: (sessionId: string | undefined) => ['sales', sessionId] as const,
    prizes: (sessionId: string | undefined) => ['prizes', sessionId] as const,
    expenses: (sessionId: string | undefined) => ['expenses', sessionId] as const,

    // Agency/Encargada related
    agencySession: (agencyId: string | undefined, date: string) => ['agency-session', agencyId, date] as const,
    agencySummary: (agencyId: string | undefined, date: string) => ['agency-summary', agencyId, date] as const,
    agencyDetails: (agencyId: string | undefined, date: string) => ['agency-details', agencyId, date] as const,
};
