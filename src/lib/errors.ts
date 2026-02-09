export class AppError extends Error {
    public readonly code: string;
    public readonly context?: any;

    constructor(message: string, code: string = 'UNKNOWN_ERROR', context?: any) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.context = context;
    }
}

export const ErrorCodes = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    DB_ERROR: 'DB_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export function handleError(error: unknown): AppError {
    if (error instanceof AppError) {
        return error;
    }

    if (error instanceof Error) {
        return new AppError(error.message, ErrorCodes.UNKNOWN_ERROR, { originalError: error });
    }

    return new AppError('Ha ocurrido un error inesperado', ErrorCodes.UNKNOWN_ERROR, { originalError: error });
}

export function isSupabaseError(error: any): boolean {
    return error && typeof error === 'object' && 'code' in error && 'message' in error && 'details' in error;
}

export function mapSupabaseError(error: any, defaultMsg = 'Error en la base de datos'): AppError {
    if (!error) return new AppError(defaultMsg, ErrorCodes.UNKNOWN_ERROR);

    // PGRST116: JSON object requested, multiple (or no) rows returned
    if (error.code === 'PGRST116') {
        return new AppError('No se encontraron datos', ErrorCodes.NOT_FOUND, error);
    }

    // 23505: Unique violation
    if (error.code === '23505') {
        return new AppError('Ya existe un registro con estos datos', ErrorCodes.VALIDATION_ERROR, error);
    }

    return new AppError(error.message || defaultMsg, ErrorCodes.DB_ERROR, error);
}
