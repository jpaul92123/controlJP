const mongoose = require('mongoose');

const prestamoShema = new mongoose.Schema({
  // Datos básicos
  nombre: { type: String, required: true },
  entidad: { type: String, required: true },
  
  // Montos
  montoPrestamo: { type: Number, required: true, min: 0 }, // Monto original prestado
  tasaInteres: { type: Number, default: 0, min: 0 }, // Porcentaje de interés (ej: 15)
  montoInteres: { type: Number, default: 0, min: 0 }, // Monto calculado del interés
  montoTotal: { type: Number, required: true, min: 0 }, // Monto total a pagar (con intereses)
  
  // Pagos
  montoPagado: { type: Number, default: 0 }, // Total pagado hasta ahora
  saldoPendiente: { type: Number, default: 0 }, // Saldo que falta por pagar
  saldoInicial: { type: Number, default: 0 }, // Saldo inicial (para referencia)
  
  // Cuotas
  cuotas: { type: Number, required: true, min: 1 },
  cuotasPagadas: { type: Number, default: 0 },
  montoPorCuota: { type: Number, required: true, min: 0 },
  
  // Fechas
  fechaInicio: { type: Date, required: true },
  fechaFin: { type: Date },
  fechaProximoPago: { type: Date },
  
  // Estado y categoría
  estado: {
    type: String,
    enum: ['Activo', 'Completado', 'Atrasado', 'Cancelado'],
    default: 'Activo'
  },
  categoria: {
    type: String,
    enum: ['Préstamo bancario', 'Préstamo personal', 'Préstamo vehicular', 'Hipoteca', 'Tarjeta de crédito', 'Otro'],
    default: 'Préstamo bancario'
  },
  
  // Historial de pagos
  pagos: [{
    fecha: { type: Date, default: Date.now },
    monto: { type: Number, required: true },
    cuotaNumero: { type: Number },
    metodoPago: { 
      type: String, 
      enum: ['Efectivo', 'Transferencia', 'Tarjeta', 'Yape/Plin', 'Otro'], 
      default: 'Efectivo' 
    },
    comprobante: { type: String },
    observacion: { type: String },
    // Nuevos campos para seguimiento
    interesPagado: { type: Number, default: 0 },
    capitalPagado: { type: Number, default: 0 }
  }],
  
  // Observaciones
  observacion: { type: String, default: '' }
  
}, { timestamps: true });

// ============================================
// MIDDLEWARE: Calcular automáticamente antes de guardar
// ============================================
prestamoShema.pre('save', function(next) {
  // Calcular monto de interés
  if (this.tasaInteres > 0 && this.montoPrestamo > 0) {
    this.montoInteres = (this.montoPrestamo * this.tasaInteres) / 100;
    this.montoTotal = this.montoPrestamo + this.montoInteres;
  }
  
  // Si el monto total viene directamente (por si ya está calculado)
  if (this.montoTotal === 0 && this.montoPrestamo > 0) {
    this.montoTotal = this.montoPrestamo;
  }
  
  // Calcular saldo pendiente
  this.saldoPendiente = this.montoTotal - this.montoPagado;
  
  // Calcular monto por cuota si no está definido
  if (this.montoPorCuota === 0 && this.cuotas > 0) {
    this.montoPorCuota = this.montoTotal / this.cuotas;
  }
  
  // Calcular fecha fin
  if (this.fechaInicio && this.cuotas > 0) {
    const fechaFin = new Date(this.fechaInicio);
    fechaFin.setMonth(fechaFin.getMonth() + this.cuotas);
    this.fechaFin = fechaFin;
  }
  
  // Calcular fecha próximo pago
  if (this.fechaInicio && this.cuotasPagadas < this.cuotas) {
    const fechaProximo = new Date(this.fechaInicio);
    fechaProximo.setMonth(fechaProximo.getMonth() + this.cuotasPagadas);
    this.fechaProximoPago = fechaProximo;
  }
  
  // Actualizar estado
  if (this.saldoPendiente <= 0) {
    this.estado = 'Completado';
  }
  
  next();
});

module.exports = mongoose.model('Prestamo', prestamoShema);