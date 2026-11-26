const Egreso = require('../models/Egresos');
const Prestamo = require('../models/Prestamo');
const PagoServicio = require('../models/PagoServicio');

// ============================================
// FUNCIÓN HELPER PARA PROCESAR FECHAS CON HORA
// ============================================
function procesarFechaConHora(fecha, hora) {
  if (!fecha) return new Date();
  
  // Separar año, mes, día
  const [year, month, day] = fecha.split('-').map(Number);
  
  // Si hay hora, usarla, sino usar 00:00
  if (hora) {
    const [hours, minutes] = hora.split(':').map(Number);
    // Crear fecha con hora específica en zona horaria local
    return new Date(year, month - 1, day, hours || 0, minutes || 0);
  } else {
    // Solo fecha, sin hora específica (medianoche)
    return new Date(year, month - 1, day);
  }
}

// ============================================
// FUNCIÓN PARA FORMATEAR FECHA CON HORA
// ============================================
function formatearFechaConHora(fecha) {
  if (!fecha) return '';
  
  return new Date(fecha).toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

// ============================================
// 1. LISTAR TODOS LOS EGRESOS (VISTA)
// ============================================
exports.list = async (req, res) => {
  try {
    const { buscar, categoria, fechaInicio, fechaFin, orden } = req.query;
    
    // Construir filtro
    let filtro = {};
    
    // Búsqueda por descripción
    if (buscar && buscar.trim() !== '') {
      filtro.descripcion = { $regex: buscar.trim(), $options: 'i' };
    }
    
    // Filtro por categoría
    if (categoria && categoria.trim() !== '') {
      filtro.categoria = categoria.trim();
    }
    
    // Filtro por rango de fechas
    if (fechaInicio || fechaFin) {
      filtro.fecha = {};
      if (fechaInicio) {
        const inicio = new Date(fechaInicio);
        inicio.setHours(0, 0, 0, 0);
        filtro.fecha.$gte = inicio;
      }
      if (fechaFin) {
        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);
        filtro.fecha.$lte = fin;
      }
    }
    
    // Ordenamiento: 1 = antiguos, -1 = nuevos
    const ordenNum = parseInt(orden) || -1;
    
    // Obtener egresos
    const egresos = await Egreso.find(filtro).sort({ fecha: ordenNum });
    const totalEgresos = egresos.reduce((sum, eg) => sum + eg.monto, 0);
    
    res.render('egresos', { 
      title: 'Egresos',
      egresos,
      totalEgresos,
      buscar: buscar || '',
      categoriaSeleccionada: categoria || '',
      fechaInicio: fechaInicio || '',
      fechaFin: fechaFin || '',
      orden: orden || '-1'
    });
    
  } catch (error) {
    console.error('❌ Error al listar egresos:', error);
    res.status(500).send('Error al listar egresos');
  }
};

// ============================================
// 2. API - LISTAR EGRESOS (BÚSQUEDA EN TIEMPO REAL)
// ============================================
// ============================================
// API - LISTAR EGRESOS (BÚSQUEDA EN TIEMPO REAL)
// ============================================
exports.apiList = async (req, res) => {
  try {
    const { buscar, categoria, fechaInicio, fechaFin, orden } = req.query;
    
    // Construir filtro
    let filtro = {};
    
    // Búsqueda por descripción
    if (buscar && buscar.trim() !== '') {
      filtro.descripcion = { $regex: buscar.trim(), $options: 'i' };
    }
    
    // Filtro por categoría
    if (categoria && categoria.trim() !== '') {
      filtro.categoria = categoria.trim();
    }
    
    // Filtro por rango de fechas
    if (fechaInicio || fechaFin) {
      filtro.fecha = {};
      if (fechaInicio) {
        const inicio = new Date(fechaInicio);
        inicio.setHours(0, 0, 0, 0);
        filtro.fecha.$gte = inicio;
      }
      if (fechaFin) {
        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);
        filtro.fecha.$lte = fin;
      }
    }
    
    // Ordenamiento: 1 = antiguos, -1 = nuevos
    const ordenNum = parseInt(orden) || 1;
    
    // Obtener egresos
    const egresos = await Egreso.find(filtro).sort({ fecha: ordenNum });
    const total = egresos.reduce((sum, eg) => sum + eg.monto, 0);
    
    // Formatear fechas con hora para enviar al frontend
    const egresosFormateados = egresos.map(eg => ({
      ...eg.toObject(),
      fechaFormateada: eg.fecha ? new Date(eg.fecha).toLocaleString('es-PE', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }) : '—'
    }));
    
    res.json({
      success: true,
      egresos: egresosFormateados,
      total,
      cantidad: egresos.length
    });
    
  } catch (error) {
    console.error('❌ Error en API de egresos:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener datos' 
    });
  }
};
// ============================================
// 3. MOSTRAR FORMULARIO DE NUEVO EGRESO
// ============================================
exports.showNewForm = (req, res) => {
  try {
    res.render('egresoForm', { 
      title: 'Nuevo Egreso', 
      egreso: null 
    });
  } catch (error) {
    console.error('❌ Error al mostrar formulario:', error);
    res.status(500).send('Error al cargar el formulario');
  }
};

// ============================================
// 4. CREAR UN NUEVO EGRESO (CON HORA)
// ============================================
exports.create = async (req, res) => {
  try {
    const { 
      fecha, 
      hora,
      categoria, 
      descripcion, 
      monto, 
      medioPago, 
      origen, 
      observacion 
    } = req.body;
    
    // Validaciones
    if (!categoria || !descripcion || !monto) {
      return res.status(400).send('Los campos Categoría, Descripción y Monto son obligatorios');
    }
    
    if (parseFloat(monto) <= 0) {
      return res.status(400).send('El monto debe ser mayor a 0');
    }
    
    // Procesar fecha con hora
    const fechaProcesada = procesarFechaConHora(fecha, hora);
    
    // Crear nuevo egreso
    const egreso = new Egreso({ 
      fecha: fechaProcesada,
      categoria, 
      descripcion: descripcion.trim(), 
      monto: parseFloat(monto), 
      medioPago: medioPago || 'Efectivo', 
      origen: origen || 'Efectivo',
      observacion: observacion ? observacion.trim() : ''
    });
    
    await egreso.save();
    console.log(`✅ Egreso creado: ${egreso.descripcion} - S/ ${egreso.monto}`);
    console.log(`📅 Fecha: ${formatearFechaConHora(egreso.fecha)}`);
    res.redirect('/egresos');
    
  } catch (error) {
    console.error('❌ Error al crear egreso:', error);
    
    if (error.name === 'ValidationError') {
      const mensajes = Object.values(error.errors).map(err => err.message);
      return res.status(400).send(`Error de validación: ${mensajes.join(', ')}`);
    }
    
    res.status(500).send('Error al crear egreso');
  }
};

// ============================================
// 5. MOSTRAR FORMULARIO DE EDICIÓN
// ============================================
exports.showEditForm = async (req, res) => {
  try {
    const egreso = await Egreso.findById(req.params.id);
    
    if (!egreso) {
      return res.status(404).send('Egreso no encontrado');
    }
    
    res.render('egresoForm', { 
      title: 'Editar Egreso', 
      egreso 
    });
    
  } catch (error) {
    console.error('❌ Error al cargar formulario de edición:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).send('ID de egreso inválido');
    }
    
    res.status(500).send('Error al cargar el formulario de edición');
  }
};

// ============================================
// 6. ACTUALIZAR UN EGRESO (CON HORA)
// ============================================
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      fecha, 
      hora,
      categoria, 
      descripcion, 
      monto, 
      medioPago, 
      origen, 
      observacion 
    } = req.body;
    
    // Validaciones
    if (!categoria || !descripcion || !monto) {
      return res.status(400).send('Los campos Categoría, Descripción y Monto son obligatorios');
    }
    
    if (parseFloat(monto) <= 0) {
      return res.status(400).send('El monto debe ser mayor a 0');
    }
    
    // Procesar fecha con hora
    const fechaProcesada = procesarFechaConHora(fecha, hora);
    
    // Actualizar egreso
    const egresoActualizado = await Egreso.findByIdAndUpdate(
      id,
      { 
        fecha: fechaProcesada,
        categoria, 
        descripcion: descripcion.trim(), 
        monto: parseFloat(monto), 
        medioPago: medioPago || 'Efectivo', 
        origen: origen || 'Efectivo',
        observacion: observacion ? observacion.trim() : ''
      },
      { 
        new: true,
        runValidators: true
      }
    );
    
    if (!egresoActualizado) {
      return res.status(404).send('Egreso no encontrado');
    }
    
    console.log(`✅ Egreso actualizado: ${egresoActualizado.descripcion}`);
    res.redirect('/egresos');
    
  } catch (error) {
    console.error('❌ Error al actualizar egreso:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).send('ID de egreso inválido');
    }
    
    if (error.name === 'ValidationError') {
      const mensajes = Object.values(error.errors).map(err => err.message);
      return res.status(400).send(`Error de validación: ${mensajes.join(', ')}`);
    }
    
    res.status(500).send('Error al actualizar egreso');
  }
};

// ============================================
// 7. ELIMINAR UN EGRESO
// ============================================
// ============================================
// ELIMINAR UN EGRESO (CON VERIFICACIÓN DE REFERENCIA)
// ============================================
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar el egreso
    const egreso = await Egreso.findById(id);
    if (!egreso) {
      return res.status(404).send('Egreso no encontrado');
    }

    // ============================================
    // VERIFICAR SI EL EGRESO VIENE DEL CRONOGRAMA
    // ============================================
    if (egreso.tipoReferencia === 'prestamo' && egreso.referenciaId) {
      // Es un pago de préstamo - RESTAURAR EL PAGO
      const prestamo = await Prestamo.findById(egreso.referenciaId);
      
      if (prestamo) {
        // Buscar el pago específico en el historial
        // Usamos la fecha y el monto para identificar el pago
        const pagoIndex = prestamo.pagos.findIndex(p => 
          p.fecha.getTime() === egreso.fecha.getTime() && 
          p.monto === egreso.monto
        );
        
        if (pagoIndex !== -1) {
          // Eliminar el pago del historial
          const pagoEliminado = prestamo.pagos.splice(pagoIndex, 1)[0];
          
          // Restaurar los montos
          prestamo.montoPagado -= pagoEliminado.monto;
          prestamo.cuotasPagadas -= 1;
          prestamo.saldoPendiente = prestamo.montoTotal - prestamo.montoPagado;
          
          // Si el préstamo estaba completado, volver a activarlo
          if (prestamo.estado === 'Completado' && prestamo.saldoPendiente > 0) {
            prestamo.estado = 'Activo';
          }
          
          await prestamo.save();
          
          console.log(`✅ Pago restaurado en préstamo: ${prestamo.nombre}`);
          console.log(`   Monto restaurado: S/ ${pagoEliminado.monto}`);
          console.log(`   Nuevo saldo: S/ ${prestamo.saldoPendiente}`);
        }
      }
    }
    
    // ============================================
    // VERIFICAR SI ES PAGO DE SERVICIO
    // ============================================
    if (egreso.tipoReferencia === 'servicio' && egreso.referenciaId) {
      // Es un pago de servicio - RESTAURAR EL SERVICIO
      const servicio = await PagoServicio.findById(egreso.referenciaId);
      
      if (servicio) {
        // Buscar el pago específico en el historial
        const pagoIndex = servicio.pagos.findIndex(p => 
          p.fecha.getTime() === egreso.fecha.getTime() && 
          p.monto === egreso.monto
        );
        
        if (pagoIndex !== -1) {
          // Eliminar el pago del historial
          const pagoEliminado = servicio.pagos.splice(pagoIndex, 1)[0];
          
          // Restaurar los montos
          servicio.montoPagado -= pagoEliminado.monto;
          servicio.estado = 'Pendiente';
          servicio.fechaPago = null;
          
          await servicio.save();
          
          console.log(`✅ Pago restaurado en servicio: ${servicio.nombre}`);
          console.log(`   Monto restaurado: S/ ${pagoEliminado.monto}`);
        }
      }
    }

    // ============================================
    // ELIMINAR EL EGRESO
    // ============================================
    await Egreso.findByIdAndDelete(id);
    
    console.log(`✅ Egreso eliminado: ${egreso.descripcion} - S/ ${egreso.monto}`);
    res.redirect('/egresos');
    
  } catch (error) {
    console.error('❌ Error al eliminar egreso:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).send('ID de egreso inválido');
    }
    
    res.status(500).send('Error al eliminar egreso');
  }
};

// ============================================
// 8. OBTENER ESTADÍSTICAS (OPCIONAL)
// ============================================
exports.getEstadisticas = async (req, res) => {
  try {
    const { periodo } = req.query;
    let fechaInicio, fechaFin;
    const ahora = new Date();
    
    switch (periodo) {
      case 'today':
        fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        fechaFin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
        break;
      case 'week':
        const dia = ahora.getDay();
        const diff = ahora.getDate() - dia + (dia === 0 ? -6 : 1);
        fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), diff);
        fechaFin = new Date(ahora.getFullYear(), ahora.getMonth(), diff + 7);
        break;
      case 'month':
        fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        fechaFin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
        break;
      case 'year':
        fechaInicio = new Date(ahora.getFullYear(), 0, 1);
        fechaFin = new Date(ahora.getFullYear() + 1, 0, 1);
        break;
      default:
        fechaInicio = new Date(0);
        fechaFin = new Date();
    }
    
    const estadisticas = await Egreso.aggregate([
      {
        $match: {
          fecha: { $gte: fechaInicio, $lt: fechaFin }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$monto' },
          cantidad: { $sum: 1 },
          promedio: { $avg: '$monto' },
          maximo: { $max: '$monto' },
          minimo: { $min: '$monto' }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: estadisticas[0] || { total: 0, cantidad: 0, promedio: 0, maximo: 0, minimo: 0 }
    });
    
  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error);
    res.status(500).json({ success: false, error: 'Error al obtener estadísticas' });
  }
};
// ELIMINAR UN EGRESO (CON VERIFICACIÓN DE REFERENCIA)
// ============================================
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar el egreso
    const egreso = await Egreso.findById(id);
    if (!egreso) {
      return res.status(404).send('Egreso no encontrado');
    }

    // ============================================
    // VERIFICAR SI EL EGRESO VIENE DEL CRONOGRAMA
    // ============================================
    if (egreso.tipoReferencia === 'prestamo' && egreso.referenciaId) {
      // Es un pago de préstamo - RESTAURAR EL PAGO
      const prestamo = await Prestamo.findById(egreso.referenciaId);
      
      if (prestamo) {
        // Buscar el pago específico en el historial
        const pagoIndex = prestamo.pagos.findIndex(p => 
          p.fecha.getTime() === egreso.fecha.getTime() && 
          p.monto === egreso.monto
        );
        
        if (pagoIndex !== -1) {
          // Eliminar el pago del historial
          const pagoEliminado = prestamo.pagos.splice(pagoIndex, 1)[0];
          
          // Restaurar los montos
          prestamo.montoPagado -= pagoEliminado.monto;
          prestamo.cuotasPagadas -= 1;
          prestamo.saldoPendiente = prestamo.montoTotal - prestamo.montoPagado;
          
          // Si el préstamo estaba completado, volver a activarlo
          if (prestamo.estado === 'Completado' && prestamo.saldoPendiente > 0) {
            prestamo.estado = 'Activo';
          }
          
          await prestamo.save();
          
          console.log(`✅ Pago restaurado en préstamo: ${prestamo.nombre}`);
          console.log(`   Monto restaurado: S/ ${pagoEliminado.monto}`);
          console.log(`   Nuevo saldo: S/ ${prestamo.saldoPendiente}`);
        }
      }
    }
    
    // ============================================
    // VERIFICAR SI ES PAGO DE SERVICIO
    // ============================================
    if (egreso.tipoReferencia === 'servicio' && egreso.referenciaId) {
      // Es un pago de servicio - RESTAURAR EL SERVICIO
      const servicio = await PagoServicio.findById(egreso.referenciaId);
      
      if (servicio) {
        // Buscar el pago específico en el historial
        const pagoIndex = servicio.pagos.findIndex(p => 
          p.fecha.getTime() === egreso.fecha.getTime() && 
          p.monto === egreso.monto
        );
        
        if (pagoIndex !== -1) {
          // Eliminar el pago del historial
          const pagoEliminado = servicio.pagos.splice(pagoIndex, 1)[0];
          
          // Restaurar los montos
          servicio.montoPagado -= pagoEliminado.monto;
          servicio.estado = 'Pendiente';
          servicio.fechaPago = null;
          
          await servicio.save();
          
          console.log(`✅ Pago restaurado en servicio: ${servicio.nombre}`);
          console.log(`   Monto restaurado: S/ ${pagoEliminado.monto}`);
        }
      }
    }

    // ============================================
    // ELIMINAR EL EGRESO
    // ============================================
    await Egreso.findByIdAndDelete(id);
    
    console.log(`✅ Egreso eliminado: ${egreso.descripcion} - S/ ${egreso.monto}`);
    res.redirect('/egresos');
    
  } catch (error) {
    console.error('❌ Error al eliminar egreso:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).send('ID de egreso inválido');
    }
    
    res.status(500).send('Error al eliminar egreso');
  }
};