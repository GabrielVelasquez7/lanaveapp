import { format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

// Zona horaria de Venezuela
const VENEZUELA_TIMEZONE = 'America/Caracas'; // UTC-4

/**
 * Obtiene la fecha actual en zona horaria de Venezuela
 */
export const getVenezuelaDate = (): Date => {
  return toZonedTime(new Date(), VENEZUELA_TIMEZONE);
};

/**
 * Convierte una fecha a zona horaria de Venezuela
 */
export const toVenezuelaTime = (date: Date): Date => {
  return toZonedTime(date, VENEZUELA_TIMEZONE);
};

/**
 * Convierte una fecha de zona horaria de Venezuela a UTC para la base de datos
 */
export const fromVenezuelaTime = (date: Date): Date => {
  return fromZonedTime(date, VENEZUELA_TIMEZONE);
};

/**
 * Formatea una fecha para usar en consultas de base de datos (YYYY-MM-DD)
 * 
 * IMPORTANTE: Esta función extrae los componentes de fecha directamente del objeto Date
 * sin aplicar conversión de zona horaria. Esto es necesario porque cuando el usuario
 * selecciona una fecha del calendario, el componente Calendar devuelve un Date con
 * la fecha deseada en la zona horaria local. Aplicar toVenezuelaTime() causaría un
 * desfase de un día cuando la fecha tiene hora 00:00:00 UTC.
 * 
 * Si necesitas la fecha actual de Venezuela, usa getTodayVenezuela() en su lugar.
 */
export const formatDateForDB = (date: Date): string => {
  // Extraer componentes directamente del Date sin conversión de timezone
  // Esto funciona correctamente porque el calendario devuelve la fecha que el usuario seleccionó
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD para Venezuela
 */
export const getTodayVenezuela = (): string => {
  return formatDateForDB(new Date());
};

/**
 * Verifica si una fecha está en el futuro según la zona horaria de Venezuela
 */
export const isFutureInVenezuela = (date: Date): boolean => {
  const today = getVenezuelaDate();
  const compareDate = toVenezuelaTime(date);
  
  // Comparar solo las fechas (sin hora)
  const todayStr = format(today, 'yyyy-MM-dd');
  const compareDateStr = format(compareDate, 'yyyy-MM-dd');
  
  return compareDateStr > todayStr;
};

/**
 * Obtiene el inicio del día en zona horaria de Venezuela
 */
export const getStartOfDayVenezuela = (date: Date): Date => {
  const venezuelaDate = toVenezuelaTime(date);
  venezuelaDate.setHours(0, 0, 0, 0);
  return venezuelaDate;
};

/**
 * Obtiene el final del día en zona horaria de Venezuela
 */
export const getEndOfDayVenezuela = (date: Date): Date => {
  const venezuelaDate = toVenezuelaTime(date);
  venezuelaDate.setHours(23, 59, 59, 999);
  return venezuelaDate;
};