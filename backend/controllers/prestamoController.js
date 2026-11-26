const Prestamo = require('../models/Prestamo');
const Egreso = require('../models/Egresos');

// ============================================
// FUNCIÓN PARA FORMATEAR FECHA
// ============================================
function formatearFecha(fecha) {
  if (!fecha) return '';
  return new Date(fecha).toLocaleDateString('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

// ============================================
// LISTAR PRÉSTAMOS
// ============================================
exports.list = async (req, res) => {
  try {
    const prestamos = await Prestamo.find().sort({ fechaInicio: -1 });
    res.render('cronograma/prestamoForm', {
      title: 'Préstamos',
      prestamos,
      prestamo: null
    });
  } catch (error) {
    console.error('❌ Error al listar préstamos:', error);
    res.status(500).send('Error al listar préstamos');
  }
};

// ============================================
// MOSTRAR FORMULARIO NUEVO PRÉSTAMO
// ============================================
exports.showNewForm = (req, res) => {
  try {
    res.render('cronograma/prestamoForm', {
      title: 'Nuevo Préstamo',
      prestamo: null
    });
  } catch (error) {
    console.error('❌ Error al mostrar formulario:', error);
    res.status(500).send('Error al cargar el formulario');
  }
};

// ============================================
// CREAR PRÉSTAMO
// ============================================
exports.create = async (req, res) => {
  try {
    const {
      nombre,
      entidad,
      montoPrestamo,
      tasaInteres,
      montoTotal,
      cuotas,
      fechaInicio,
      categoria,
      observacion
    } = req.body;

    // Validaciones
    if (!nombre || !entidad || !montoPrestamo || !cuotas || !fechaInicio) {
      return res.status(400).send('Todos los campos obligatorios deben estar llenos');
    }

    const montoPrestamoNum = parseFloat(montoPrestamo);
    const tasaInteresNum = parseFloat(tasaInteres) || 0;
    const montoTotalNum = montoTotal ? parseFloat(montoTotal) : montoPrestamoNum;

    // Calcular monto por cuota
    const montoPorCuota = montoTotalNum / parseInt(cuotas);

    const prestamo = new Prestamo({
      nombre,
      entidad,
      montoPrestamo: montoPrestamoNum,
      tasaInteres: tasaInteresNum,
      montoTotal: montoTotalNum,
      cuotas: parseInt(cuotas),
      montoPorCuota: parseFloat(montoPorCuota.toFixed(2)),
      fechaInicio: new Date(fechaInicio),
      categoria: categoria || 'Préstamo bancario',
      observacion: observacion || '',
      saldoPendiente: montoTotalNum,
      saldoInicial: montoTotalNum
    });

    await prestamo.save();
    console.log(`✅ Préstamo creado: ${nombre} - Monto: S/ ${montoPrestamoNum} - Total con intereses: S/ ${montoTotalNum}`);
    res.redirect('/cronograma');
    
  } catch (error) {
    console.error('❌ Error al crear préstamo:', error);
    
    if (error.name === 'ValidationError') {
      const mensajes = Object.values(error.errors).map(err => err.message);
      return res.status(400).send(`Error de validación: ${mensajes.join(', ')}`);
    }
    
    res.status(500).send('Error al crear préstamo');
  }
};

// ============================================
// PAGAR CUOTA DE PRÉSTAMO
// ============================================
exports.pagarCuota = async (req, res) => {
  try {
    const { id } = req.params;
    const { monto, metodoPago, origen, observacion } = req.body;

    const prestamo = await Prestamo.findById(id);
    if (!prestamo) {
      return res.status(404).send('Préstamo no encontrado');
    }

    const montoPago = parseFloat(monto);
    
    // Verificar que no exceda el saldo pendiente
    if (montoPago > prestamo.saldoPendiente) {
      return res.status(400).send('El monto excede el saldo pendiente');
    }

    // Calcular cuota número
    const cuotaNumero = prestamo.cuotasPagadas + 1;

    // Calcular distribución del pago (interés vs capital)
    // Proporcional: el interés se paga primero, luego capital
    const proporcionInteres = prestamo.montoInteres / prestamo.montoTotal;
    const interesPagado = montoPago * proporcionInteres;
    const capitalPagado = montoPago - interesPagado;

    // Registrar el pago en el préstamo
    const nuevoPago = {
      fecha: new Date(),
      monto: montoPago,
      cuotaNumero: cuotaNumero,
      metodoPago: metodoPago || 'Efectivo',
      observacion: observacion || `Pago cuota ${cuotaNumero}`,
      interesPagado: parseFloat(interesPagado.toFixed(2)),
      capitalPagado: parseFloat(capitalPagado.toFixed(2))
    };

    prestamo.pagos.push(nuevoPago);
    prestamo.montoPagado += montoPago;
    prestamo.cuotasPagadas += 1;
    prestamo.saldoPendiente = prestamo.montoTotal - prestamo.montoPagado;

    if (prestamo.saldoPendiente <= 0) {
      prestamo.estado = 'Completado';
      prestamo.saldoPendiente = 0;
    }

    await prestamo.save();

    // ============================================
    // REGISTRAR EN EGRESOS AUTOMÁTICAMENTE
    // ============================================
    const egreso = new Egreso({
      fecha: new Date(),
      categoria: 'Pago de préstamo',
      descripcion: `Pago de préstamo: ${prestamo.nombre} - Cuota ${cuotaNumero} (Interés: S/ ${interesPagado.toFixed(2)}, Capital: S/ ${capitalPagado.toFixed(2)})`,
      monto: montoPago,
      medioPago: metodoPago || 'Efectivo',
      origen: origen || 'Efectivo',
      observacion: `Pago automático del préstamo ${prestamo.nombre}\nCuota ${cuotaNumero} de ${prestamo.cuotas}\nSaldo restante: S/ ${prestamo.saldoPendiente.toFixed(2)}`
    });

    await egreso.save();

    console.log(`✅ Pago de préstamo registrado: ${prestamo.nombre} - S/ ${montoPago}`);
    console.log(`   Interés pagado: S/ ${interesPagado.toFixed(2)}`);
    console.log(`   Capital pagado: S/ ${capitalPagado.toFixed(2)}`);
    console.log(`   Saldo restante: S/ ${prestamo.saldoPendiente.toFixed(2)}`);
    console.log(`✅ Egreso generado automáticamente`);

    res.redirect('/cronograma');
    
  } catch (error) {
    console.error('❌ Error al pagar cuota:', error);
    res.status(500).send('Error al pagar cuota');
  }
};

// ============================================
// ELIMINAR PRÉSTAMO
// ============================================
exports.delete = async (req, res) => {
  try {
    await Prestamo.findByIdAndDelete(req.params.id);
    res.redirect('/cronograma');
  } catch (error) {
    console.error('❌ Error al eliminar préstamo:', error);
    res.status(500).send('Error al eliminar préstamo');
  }
};

// ============================================
// OBTENER DETALLE DE PRÉSTAMO (API)
// ============================================
exports.getDetalle = async (req, res) => {
  try {
    const prestamo = await Prestamo.findById(req.params.id);
    if (!prestamo) {
      return res.status(404).json({ success: false, error: 'Préstamo no encontrado' });
    }
    
    res.json({
      success: true,
      prestamo: {
        ...prestamo.toObject(),
        fechaInicio: formatearFecha(prestamo.fechaInicio),
        fechaFin: formatearFecha(prestamo.fechaFin),
        pagos: prestamo.pagos.map(p => ({
          ...p.toObject(),
          fecha: formatearFecha(p.fecha)
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error al obtener detalle:', error);
    res.status(500).json({ success: false, error: 'Error al obtener detalle' });
  }
};
// ============================================
// PAGAR CUOTA DE PRÉSTAMO (CON REFERENCIA)
// ============================================
exports.pagarCuota = async (req, res) => {
  try {
    const { id } = req.params;
    const { monto, metodoPago, origen, observacion } = req.body;

    const prestamo = await Prestamo.findById(id);
    if (!prestamo) {
      return res.status(404).send('Préstamo no encontrado');
    }

    const montoPago = parseFloat(monto);
    
    if (montoPago > prestamo.saldoPendiente) {
      return res.status(400).send('El monto excede el saldo pendiente');
    }

    const cuotaNumero = prestamo.cuotasPagadas + 1;

    // Calcular distribución del pago
    const proporcionInteres = prestamo.montoInteres / prestamo.montoTotal;
    const interesPagado = montoPago * proporcionInteres;
    const capitalPagado = montoPago - interesPagado;

    // Registrar el pago en el préstamo
    const nuevoPago = {
      fecha: new Date(),
      monto: montoPago,
      cuotaNumero: cuotaNumero,
      metodoPago: metodoPago || 'Efectivo',
      observacion: observacion || `Pago cuota ${cuotaNumero}`,
      interesPagado: parseFloat(interesPagado.toFixed(2)),
      capitalPagado: parseFloat(capitalPagado.toFixed(2))
    };

    prestamo.pagos.push(nuevoPago);
    prestamo.montoPagado += montoPago;
    prestamo.cuotasPagadas += 1;
    prestamo.saldoPendiente = prestamo.montoTotal - prestamo.montoPagado;

    if (prestamo.saldoPendiente <= 0) {
      prestamo.estado = 'Completado';
      prestamo.saldoPendiente = 0;
    }

    await prestamo.save();

    // ============================================
    // REGISTRAR EN EGRESOS CON REFERENCIA
    // ============================================
    const egreso = new Egreso({
      fecha: new Date(),
      categoria: 'Pago de préstamo',
      descripcion: `Pago de préstamo: ${prestamo.nombre} - Cuota ${cuotaNumero}`,
      monto: montoPago,
      medioPago: metodoPago || 'Efectivo',
      origen: origen || 'Efectivo',
      observacion: `Pago automático del préstamo ${prestamo.nombre}\nCuota ${cuotaNumero} de ${prestamo.cuotas}\nSaldo restante: S/ ${prestamo.saldoPendiente.toFixed(2)}`,
      // ============================================
      // NUEVO: VINCULAR CON EL PRÉSTAMO
      // ============================================
      tipoReferencia: 'prestamo',
      referenciaId: prestamo._id,
      referenciaModelo: 'Prestamo'
    });

    await egreso.save();

    console.log(`✅ Pago de préstamo registrado: ${prestamo.nombre} - S/ ${montoPago}`);
    console.log(`✅ Egreso generado con referencia al préstamo`);

    res.redirect('/cronograma');
    
  } catch (error) {
    console.error('❌ Error al pagar cuota:', error);
    res.status(500).send('Error al pagar cuota');
  }
};
// ============================================
// ELIMINAR UN PAGO DE PRÉSTAMO (RESTAURAR CUOTA)
// ============================================
exports.eliminarPago = async (req, res) => {
  try {
    const { id, pagoId } = req.params;
    
    // Buscar el préstamo
    const prestamo = await Prestamo.findById(id);
    if (!prestamo) {
      return res.status(404).send('Préstamo no encontrado');
    }
    
    // Buscar el pago en el historial
    const pagoIndex = prestamo.pagos.findIndex(p => p._id.toString() === pagoId);
    if (pagoIndex === -1) {
      return res.status(404).send('Pago no encontrado');
    }
    
    // Obtener el pago a eliminar
    const pagoEliminado = prestamo.pagos[pagoIndex];
    
    // ============================================
    // 1. ELIMINAR EL EGRESO ASOCIADO
    // ============================================
    // Buscar el egreso que tenga referencia a este pago
    const egreso = await Egreso.findOne({
      tipoReferencia: 'prestamo',
      referenciaId: prestamo._id,
      'observacion': { $regex: `Cuota ${pagoEliminado.cuotaNumero}` }
    });
    
    if (egreso) {
      await Egreso.findByIdAndDelete(egreso._id);
      console.log(`✅ Egreso eliminado automáticamente: ${egreso.descripcion}`);
    }
    
    // ============================================
    // 2. RESTAURAR EL PRÉSTAMO
    // ============================================
    // Eliminar el pago del historial
    prestamo.pagos.splice(pagoIndex, 1);
    
    // Restaurar los montos
    prestamo.montoPagado -= pagoEliminado.monto;
    prestamo.cuotasPagadas -= 1;
    prestamo.saldoPendiente = prestamo.montoTotal - prestamo.montoPagado;
    
    // Si el préstamo estaba completado y ahora tiene saldo pendiente, volver a activarlo
    if (prestamo.estado === 'Completado' && prestamo.saldoPendiente > 0) {
      prestamo.estado = 'Activo';
    }
    
    await prestamo.save();
    
    console.log(`✅ Pago eliminado del préstamo: ${prestamo.nombre}`);
    console.log(`   Cuota ${pagoEliminado.cuotaNumero} - S/ ${pagoEliminado.monto}`);
    console.log(`   Nuevo saldo: S/ ${prestamo.saldoPendiente}`);
    
    // Redirigir al cronograma
    res.redirect('/cronograma');
    
  } catch (error) {
    console.error('❌ Error al eliminar pago:', error);
    res.status(500).send('Error al eliminar el pago');
  }
};