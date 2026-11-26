const mongoose = require('mongoose');

const ingresoShema = new mongoose.Schema({
  fecha: { type: Date, default: Date.now },
  hora: { type: String, default: '00:00' },
  tipo: {
    type: String,
    enum: [
      'Venta de productos',
      'Servicio de instalación',
      'Servicio de mantenimiento',
      'Adelanto de proyecto',
      'Pago de proyecto',
      'Otros servicios',
      'Préstamo recibido',
      'Aporte de capital',
      'Otros ingresos'
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
  // NUEVO CAMPO: Destino del dinero
  destino: {
    type: String,
    enum: ['Efectivo', 'BCP', 'Interbank', 'Bim', 'Scotiabank', 'Otro'],
    default: 'Efectivo'
  },
  observacion: { type: String, default: '' }
});

module.exports = mongoose.model('Ingreso', ingresoShema);