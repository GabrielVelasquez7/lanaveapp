/**
 * Utilidades para operaciones matemáticas con precisión decimal
 * Evita problemas de punto flotante en JavaScript (ej: 0.1 + 0.2 !== 0.3)
 */

/**
 * Número de decimales para operaciones financieras
 */
const DECIMAL_PLACES = 2;

/**
 * Multiplica un número para convertirlo a entero (evita errores de punto flotante)
 */
function toInteger(value: number, decimals: number = DECIMAL_PLACES): number {
  return Math.round(value * Math.pow(10, decimals));
}

/**
 * Convierte de entero a decimal
 */
function toDecimal(value: number, decimals: number = DECIMAL_PLACES): number {
  return value / Math.pow(10, decimals);
}

/**
 * Suma con precisión decimal
 * @example preciseAdd(0.1, 0.2) // 0.3
 */
export function preciseAdd(a: number, b: number, decimals: number = DECIMAL_PLACES): number {
  const intA = toInteger(a, decimals);
  const intB = toInteger(b, decimals);
  return toDecimal(intA + intB, decimals);
}

/**
 * Resta con precisión decimal
 * @example preciseSubtract(31, 29.5) // 1.5 (no 1.4999999999999982)
 */
export function preciseSubtract(a: number, b: number, decimals: number = DECIMAL_PLACES): number {
  const intA = toInteger(a, decimals);
  const intB = toInteger(b, decimals);
  return toDecimal(intA - intB, decimals);
}

/**
 * Multiplicación con precisión decimal
 * @example preciseMultiply(0.1, 0.2) // 0.02
 */
export function preciseMultiply(a: number, b: number, decimals: number = DECIMAL_PLACES): number {
  const intA = toInteger(a, decimals);
  const intB = toInteger(b, decimals);
  return toDecimal(Math.round((intA * intB) / Math.pow(10, decimals)), decimals);
}

/**
 * División con precisión decimal
 * @example preciseDivide(1, 3) // 0.33
 */
export function preciseDivide(a: number, b: number, decimals: number = DECIMAL_PLACES): number {
  if (b === 0) return 0;
  const intA = toInteger(a, decimals);
  const intB = toInteger(b, decimals);
  return toDecimal(Math.round((intA / intB) * Math.pow(10, decimals)), decimals);
}

/**
 * Redondea a N decimales
 * @example preciseRound(1.235, 2) // 1.24
 */
export function preciseRound(value: number, decimals: number = DECIMAL_PLACES): number {
  return Number(Math.round(Number(value + 'e' + decimals)) + 'e-' + decimals);
}

/**
 * Valor absoluto con precisión decimal
 * @example preciseAbs(-31.5) // 31.5
 */
export function preciseAbs(value: number, decimals: number = DECIMAL_PLACES): number {
  return preciseRound(Math.abs(value), decimals);
}

/**
 * Compara dos números con tolerancia (para evitar falsos positivos por punto flotante)
 * @example preciseEquals(0.1 + 0.2, 0.3) // true
 */
export function preciseEquals(a: number, b: number, tolerance: number = 0.001): boolean {
  return Math.abs(a - b) < tolerance;
}

/**
 * Parsea un string a número con manejo de errores
 * Soporta formatos venezolanos (1.000,50) y estadounidenses (1,000.50)
 */
export function parseDecimal(value: string | number | undefined | null, defaultValue: number = 0): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  
  if (typeof value === 'number') {
    return isNaN(value) ? defaultValue : preciseRound(value);
  }
  
  // Limpiar el string
  let cleanValue = value.trim();
  
  // Detectar formato (VES vs USD)
  const hasCommaAndDot = cleanValue.includes(',') && cleanValue.includes('.');
  
  if (hasCommaAndDot) {
    // Si tiene ambos, determinar cuál es el separador decimal
    const lastComma = cleanValue.lastIndexOf(',');
    const lastDot = cleanValue.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      // Formato VES: 1.000,50 → 1000.50
      cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato USD: 1,000.50 → 1000.50
      cleanValue = cleanValue.replace(/,/g, '');
    }
  } else if (cleanValue.includes(',')) {
    // Solo coma - puede ser decimal o miles
    const parts = cleanValue.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      // Probablemente decimal VES
      cleanValue = cleanValue.replace(',', '.');
    } else {
      // Probablemente separador de miles USD
      cleanValue = cleanValue.replace(/,/g, '');
    }
  }
  
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? defaultValue : preciseRound(parsed);
}
