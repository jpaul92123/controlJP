// ============================================
// HELPER PARA MANEJO DE FECHAS EN ZONA HORARIA PERÚ
// ============================================

/**
 * Convierte una fecha string YYYY-MM-DD a Date en zona horaria LOCAL
 * @param {string} fechaStr - Fecha en formato YYYY-MM-DD
 * @param {string} horaStr - Hora en formato HH:MM (opcional)
 * @returns {Date} - Fecha en zona horaria local
 */
function crearFechaLocal(fechaStr, horaStr) {
  if (!fechaStr) return new Date();
  
  const [year, month, day] = fechaStr.split('-').map(Number);
  
  if (horaStr) {
    const [hours, minutes] = horaStr.split(':').map(Number);
    // Crear fecha en zona horaria LOCAL
    // IMPORTANTE: mes en JavaScript es 0-indexado (0 = Enero)
    return new Date(year, month - 1, day, hours || 0, minutes || 0);
  }
  
  // Sin hora, usar las 00:00 (medianoche) en zona horaria LOCAL
  return new Date(year, month - 1, day);
}

/**
 * Formatea fecha para mostrar en zona horaria Perú (SOLO FECHA)
 */
function formatearFecha(fecha) {
  if (!fecha) return '';
  return new Date(fecha).toLocaleDateString('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Formatea fecha con hora para mostrar en zona horaria Perú
 */
function formatearFechaConHora(fecha) {
  if (!fecha) return '';
  return new Date(fecha).toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Formatea fecha para input type="date"
 */
function formatearFechaInput(fecha) {
  if (!fecha) return '';
  
  const d = new Date(fecha);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

module.exports = {
  crearFechaLocal,
  formatearFecha,
  formatearFechaConHora,
  formatearFechaInput
};