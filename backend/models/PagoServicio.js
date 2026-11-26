const mongoose = require('mongoose');

const pagoServicioShema = new mongoose.Schema({
  nombre: { type: String, required: true },
  categoria: {
    type: String,
    enum: ['Agua', 'Luz', 'Internet', 'Teléfono', 'Gas', 'Alquiler', 'Mantenimiento', 'Seguro', 'Otro'],
    required: true
  },
  fechaVencimiento: { type: Date, required: true },
  fechaPago: { type: Date },
  monto: { type: Number, required: true, min: 0 },
  montoPagado: { type: Number, default: 0 },
  estado: {
    type: String,
    enum: ['Pendiente', 'Pagado', 'Vencido', 'Completado'],
    default: 'Pendiente'
  },
  metodoPago: {
    type: String,
    enum: ['Efectivo', 'Transferencia', 'Tarjeta', 'Yape/Plin', 'Otro'],
    default: 'Efectivo'
  },
  comprobante: { type: String },
  origen: {
    type: String,
    enum: ['Efectivo', 'BCP', 'Interbank', 'Bim', 'Scotiabank', 'Otro'],
    default: 'Efectivo'
  },
  observacion: { type: String, default: '' },
  
  // ============================================
  // NUEVOS CAMPOS PARA RECURRENCIA
  // ============================================
  esRecurrente: { type: Boolean, default: false },
  mesActual: { type: Number }, // Mes del servicio (1-12)
  anioActual: { type: Number }, // Año del servicio
  
  // Historial de pagos
  pagos: [{
    fecha: { type: Date, default: Date.now },
    monto: { type: Number, required: true },
    metodoPago: { type: String, enum: ['Efectivo', 'Transferencia', 'Tarjeta', 'Yape/Plin', 'Otro'], default: 'Efectivo' },
    comprobante: { type: String },
    observacion: { type: String },
    mes: { type: Number }, // Mes del pago
    anio: { type: Number } // Año del pago
  }]
}, { timestamps: true });

module.exports = mongoose.model('PagoServicio', pagoServicioShema);