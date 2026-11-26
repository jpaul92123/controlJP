const PagoServicio = require('../models/PagoServicio');
const Egreso = require('../models/Egresos');
const dateHelper = require('../helpers/dateHelper');

// ============================================
// LISTAR SERVICIOS
// ============================================
exports.list = async (req, res) => {
  try {
    const servicios = await PagoServicio.find().sort({ fechaVencimiento: 1 });
    res.render('cronograma/servicioForm', {
      title: 'Pagos de Servicios',
      servicios,
      servicio: null
    });
  } catch (error) {
    console.error('❌ Error al listar servicios:', error);
    res.status(500).send('Error al listar servicios');
  }
};

// ============================================
// MOSTRAR FORMULARIO NUEVO SERVICIO
// ============================================
exports.showNewForm = (req, res) => {
  try {
    res.render('cronograma/servicioForm', {
      title: 'Nuevo Servicio',
      servicio: null
    });
  } catch (error) {
    console.error('❌ Error al mostrar formulario:', error);
    res.status(500).send('Error al cargar el formulario');
  }
};

// ============================================
// MOSTRAR FORMULARIO EDITAR SERVICIO
// ============================================
exports.showEditForm = async (req, res) => {
  try {
    const servicio = await PagoServicio.findById(req.params.id);
    if (!servicio) {
      return res.status(404).send('Servicio no encontrado');
    }
    
    res.render('cronograma/servicioForm', {
      title: 'Editar Servicio',
      servicio: servicio
    });
  } catch (error) {
    console.error('❌ Error al mostrar formulario de edición:', error);
    res.status(500).send('Error al cargar el formulario');
  }
};

// ============================================
// CREAR SERVICIO
// ============================================
exports.create = async (req, res) => {
  try {
    const {
      nombre,
      categoria,
      fechaVencimiento,
      monto,
      esRecurrente,
      observacion
    } = req.body;

    const fecha = new Date(fechaVencimiento);
    
    const servicio = new PagoServicio({
      nombre,
      categoria,
      fechaVencimiento: fecha,
      monto: parseFloat(monto),
      estado: 'Pendiente',
      esRecurrente: esRecurrente === 'on' ? true : false,
      mesActual: fecha.getMonth() + 1,
      anioActual: fecha.getFullYear(),
      observacion
    });

    await servicio.save();
    console.log(`✅ Servicio creado: ${nombre} - S/ ${monto}`);
    res.redirect('/cronograma');
    
  } catch (error) {
    console.error('❌ Error al crear servicio:', error);
    res.status(500).send('Error al crear servicio');
  }
};

// ============================================
// ACTUALIZAR SERVICIO
// ============================================
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      categoria,
      fechaVencimiento,
      monto,
      esRecurrente,
      observacion
    } = req.body;

    const fecha = new Date(fechaVencimiento);
    
    const servicioActualizado = await PagoServicio.findByIdAndUpdate(
      id,
      {
        nombre,
        categoria,
        fechaVencimiento: fecha,
        monto: parseFloat(monto),
        esRecurrente: esRecurrente === 'on' ? true : false,
        mesActual: fecha.getMonth() + 1,
        anioActual: fecha.getFullYear(),
        observacion
      },
      { new: true, runValidators: true }
    );

    if (!servicioActualizado) {
      return res.status(404).send('Servicio no encontrado');
    }

    console.log(`✅ Servicio actualizado: ${nombre} - S/ ${monto}`);
    res.redirect('/cronograma');
    
  } catch (error) {
    console.error('❌ Error al actualizar servicio:', error);
    res.status(500).send('Error al actualizar servicio');
  }
};

// ============================================
// PAGAR SERVICIO
// ============================================
exports.pagar = async (req, res) => {
  try {
    const { id } = req.params;
    const { monto, metodoPago, origen, observacion } = req.body;

    const servicio = await PagoServicio.findById(id);
    if (!servicio) {
      return res.status(404).send('Servicio no encontrado');
    }

    // Si ya está pagado, no permitir pagar de nuevo
    if (servicio.estado === 'Pagado' || servicio.estado === 'Completado') {
      return res.status(400).send('Este servicio ya ha sido pagado');
    }

    const montoPago = parseFloat(monto) || servicio.monto;

    // Registrar el pago
    const fechaActual = new Date();
    const nuevoPago = {
      fecha: fechaActual,
      monto: montoPago,
      metodoPago: metodoPago || 'Efectivo',
      observacion: observacion || `Pago de ${servicio.nombre}`,
      mes: fechaActual.getMonth() + 1,
      anio: fechaActual.getFullYear()
    };

    servicio.pagos.push(nuevoPago);
    servicio.montoPagado += montoPago;
    servicio.fechaPago = fechaActual;
    servicio.estado = 'Pagado';
    servicio.metodoPago = metodoPago || 'Efectivo';
    servicio.origen = origen || 'Efectivo';

    await servicio.save();

    // Registrar en Egresos
    const egreso = new Egreso({
      fecha: fechaActual,
      categoria: 'Servicios',
      descripcion: `Pago de servicio: ${servicio.nombre} (${servicio.categoria})`,
      monto: montoPago,
      medioPago: metodoPago || 'Efectivo',
      origen: origen || 'Efectivo',
      observacion: `Pago automático del servicio ${servicio.nombre}`,
      tipoReferencia: 'servicio',
      referenciaId: servicio._id,
      referenciaModelo: 'PagoServicio'
    });

    await egreso.save();

    console.log(`✅ Pago de servicio registrado: ${servicio.nombre} - S/ ${montoPago}`);

    // Crear siguiente mes si es recurrente
    if (servicio.esRecurrente) {
      const fechaVencimiento = new Date(servicio.fechaVencimiento);
      fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 1);
      
      const existeSiguiente = await PagoServicio.findOne({
        nombre: servicio.nombre,
        categoria: servicio.categoria,
        mesActual: fechaVencimiento.getMonth() + 1,
        anioActual: fechaVencimiento.getFullYear(),
        estado: 'Pendiente'
      });

      if (!existeSiguiente) {
        const nuevoServicio = new PagoServicio({
          nombre: servicio.nombre,
          categoria: servicio.categoria,
          fechaVencimiento: fechaVencimiento,
          monto: servicio.monto,
          estado: 'Pendiente',
          esRecurrente: true,
          mesActual: fechaVencimiento.getMonth() + 1,
          anioActual: fechaVencimiento.getFullYear(),
          observacion: `Generado automáticamente para ${fechaVencimiento.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })}`
        });
        
        await nuevoServicio.save();
        console.log(`✅ Servicio recurrente generado para el mes siguiente: ${servicio.nombre}`);
      }
    } else {
      servicio.estado = 'Completado';
      await servicio.save();
      console.log(`✅ Servicio no recurrente marcado como completado: ${servicio.nombre}`);
    }

    res.redirect('/cronograma');
    
  } catch (error) {
    console.error('❌ Error al pagar servicio:', error);
    res.status(500).send('Error al pagar servicio');
  }
};

// ============================================
// ELIMINAR UN PAGO DE SERVICIO
// ============================================
exports.eliminarPago = async (req, res) => {
  try {
    const { id, pagoId } = req.params;
    
    const servicio = await PagoServicio.findById(id);
    if (!servicio) {
      return res.status(404).send('Servicio no encontrado');
    }
    
    const pagoIndex = servicio.pagos.findIndex(p => p._id.toString() === pagoId);
    if (pagoIndex === -1) {
      return res.status(404).send('Pago no encontrado');
    }
    
    const pagoEliminado = servicio.pagos[pagoIndex];
    
    // Eliminar el egreso asociado
    const egreso = await Egreso.findOne({
      tipoReferencia: 'servicio',
      referenciaId: servicio._id,
      'observacion': { $regex: servicio.nombre }
    });
    
    if (egreso) {
      await Egreso.findByIdAndDelete(egreso._id);
      console.log(`✅ Egreso eliminado automáticamente: ${egreso.descripcion}`);
    }
    
    servicio.pagos.splice(pagoIndex, 1);
    servicio.montoPagado -= pagoEliminado.monto;
    servicio.estado = 'Pendiente';
    servicio.fechaPago = null;
    
    await servicio.save();
    
    console.log(`✅ Pago eliminado del servicio: ${servicio.nombre}`);
    res.redirect('/cronograma');
    
  } catch (error) {
    console.error('❌ Error al eliminar pago:', error);
    res.status(500).send('Error al eliminar el pago');
  }
};

// ============================================
// ELIMINAR SERVICIO COMPLETO
// ============================================
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    
    const servicio = await PagoServicio.findById(id);
    if (!servicio) {
      return res.status(404).send('Servicio no encontrado');
    }
    
    // Verificar si tiene pagos
    if (servicio.pagos && servicio.pagos.length > 0) {
      return res.status(400).send('No se puede eliminar un servicio con pagos registrados. Elimine los pagos primero.');
    }
    
    await PagoServicio.findByIdAndDelete(id);
    console.log(`✅ Servicio eliminado: ${servicio.nombre}`);
    res.redirect('/cronograma');
    
  } catch (error) {
    console.error('❌ Error al eliminar servicio:', error);
    res.status(500).send('Error al eliminar servicio');
  }
};