const mongoose = require('mongoose');

const egresoShema = new mongoose.Schema({
  fecha: { type: Date, default: Date.now },
  categoria: {
    type: String,
    enum: [
      'Compra de mercadería',
      'Compra de equipos',
      'Compra de materiales',
      'Compra de herramientas',
      'Pago de personal',
      'Adelanto de personal',
      'Honorarios',
      'Combustible',
      'Pasajes',
      'Taxi/movilidad',
      'Peajes',
      'Estacionamiento',
      'Alimentación',
      'Servicios',
      'Internet',
      'Telefonía',
      'Alquiler',
      'Publicidad',
      'Software',
      'Otros',
      'Pago de préstamo',
      'Intereses',
      'Comisiones bancarias',
      'Otros gastos'
    ],
    required: true
  },
  descripcion: { type: String, required: true },
  monto: { type: Number, required: true, min: 0 },
  medioPago: {
    type: String,
    enum: ['Efectivo', 'Transferencia', 'Tarjeta', 'Yape/Plin', 'Otro'],
    default: 'Efectivo'
  },
  origen: {
    type: String,
    enum: ['Efectivo', 'BCP', 'Interbank', 'Bim', 'Scotiabank', 'Otro'],
    default: 'Efectivo'
  },
  observacion: { type: String, default: '' },
  
  // ============================================
  // NUEVOS CAMPOS PARA VINCULAR CON CRONOGRAMA
  // ============================================
  tipoReferencia: {
    type: String,
    enum: ['prestamo', 'servicio', 'ninguno'],
    default: 'ninguno'
  },
  referenciaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Referencia',
    default: null
  },
  // Para saber qué tipo de referencia es
  referenciaModelo: {
    type: String,
    enum: ['Prestamo', 'PagoServicio', 'Ninguno'],
    default: 'Ninguno'
  }
});

module.exports = mongoose.model('Egreso', egresoShema);