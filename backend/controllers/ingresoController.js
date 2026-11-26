const Ingreso = require('../models/Ingresos');

// ============================================
// FUNCIÓN HELPER PARA PROCESAR FECHAS
// ============================================
function procesarFecha(fecha) {
  if (!fecha) return new Date();
  
  // Si es un string en formato YYYY-MM-DD
  if (typeof fecha === 'string' && fecha.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = fecha.split('-').map(Number);
    // CREAR FECHA EN ZONA HORARIA LOCAL (PERÚ)
    // IMPORTANTE: Mes en JavaScript es 0-indexado (0 = Enero)
    const fechaLocal = new Date(year, month - 1, day);
    
    // 🔧 CORRECCIÓN: No ajustar offset, dejar que Node.js maneje la zona horaria
    // Ya que configuramos process.env.TZ = 'America/Lima'
    return fechaLocal;
  }
  
  // Si ya es un objeto Date o viene de MongoDB
  return new Date(fecha);
}

// ============================================
// FUNCIÓN PARA FORMATEAR FECHA CON HORA
// ============================================
function formatearFechaConHora(fecha) {
  if (!fecha) return '';
  
  // Usar directamente toLocaleString con timeZone
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
// 1. LISTAR TODOS LOS INGRESOS (VISTA)
// ============================================
exports.list = async (req, res) => {
  try {
    const { buscar, tipo, fechaInicio, fechaFin, orden } = req.query;
    
    // Construir filtro
    let filtro = {};
    
    // Búsqueda por descripción
    if (buscar && buscar.trim() !== '') {
      filtro.descripcion = { $regex: buscar.trim(), $options: 'i' };
    }
    
    // Filtro por tipo
    if (tipo && tipo.trim() !== '') {
      filtro.tipo = tipo.trim();
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
    
    // Obtener ingresos
    const ingresos = await Ingreso.find(filtro).sort({ fecha: ordenNum });
    const totalIngresos = ingresos.reduce((sum, ing) => sum + ing.monto, 0);
    
    res.render('ingresos', { 
      title: 'Ingresos',
      ingresos,
      totalIngresos,
      buscar: buscar || '',
      tipoSeleccionado: tipo || '',
      fechaInicio: fechaInicio || '',
      fechaFin: fechaFin || '',
      orden: orden || '-1'
    });
    
  } catch (error) {
    console.error('❌ Error al listar ingresos:', error);
    res.status(500).send('Error al listar ingresos');
  }
};

// ============================================
// 2. API - LISTAR INGRESOS (BÚSQUEDA EN TIEMPO REAL)
// ============================================
exports.apiList = async (req, res) => {
  try {
    const { buscar, tipo, fechaInicio, fechaFin, orden } = req.query;
    
    let filtro = {};
    
    if (buscar && buscar.trim() !== '') {
      filtro.descripcion = { $regex: buscar.trim(), $options: 'i' };
    }
    
    if (tipo && tipo.trim() !== '') {
      filtro.tipo = tipo.trim();
    }
    
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
    
    const ordenNum = parseInt(orden) || 1;
    const ingresos = await Ingreso.find(filtro).sort({ fecha: ordenNum });
    const total = ingresos.reduce((sum, ing) => sum + ing.monto, 0);
    
    // 🔧 CORRECCIÓN: Formatear con la zona horaria correcta
    const ingresosFormateados = ingresos.map(ing => ({
      ...ing.toObject(),
      fechaFormateada: formatearFechaConHora(ing.fecha)
    }));
    
    res.json({
      success: true,
      ingresos: ingresosFormateados,
      total,
      cantidad: ingresos.length
    });
    
  } catch (error) {
    console.error('❌ Error en API de ingresos:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener datos' 
    });
  }
};
// ============================================
// 3. MOSTRAR FORMULARIO DE NUEVO INGRESO
// ============================================
exports.showNewForm = (req, res) => {
  try {
    res.render('ingresoForm', { 
      title: 'Nuevo Ingreso', 
      ingreso: null 
    });
  } catch (error) {
    console.error('❌ Error al mostrar formulario:', error);
    res.status(500).send('Error al cargar el formulario');
  }
};

// ============================================
// 4. CREAR UN NUEVO INGRESO
// ============================================
// CREAR UN NUEVO INGRESO (CON HORA)
// ============================================
exports.create = async (req, res) => {
  try {
    const { 
      fecha, 
      hora,
      tipo, 
      descripcion, 
      monto, 
      medioPago, 
      destino, 
      observacion 
    } = req.body;
    
    // Validaciones
    if (!tipo || !descripcion || !monto) {
      return res.status(400).send('Los campos Tipo, Descripción y Monto son obligatorios');
    }
    
    if (parseFloat(monto) <= 0) {
      return res.status(400).send('El monto debe ser mayor a 0');
    }
    
    // 🔧 PROCESAR FECHA Y HORA COMBINADAS
    let fechaProcesada;
    if (fecha) {
      // Separar año, mes, día
      const [year, month, day] = fecha.split('-').map(Number);
      
      // Si hay hora, usarla, sino usar 00:00
      if (hora) {
        const [hours, minutes] = hora.split(':').map(Number);
        // Crear fecha con hora específica en zona horaria local
        fechaProcesada = new Date(year, month - 1, day, hours, minutes);
      } else {
        // Solo fecha, sin hora específica (medianoche)
        fechaProcesada = new Date(year, month - 1, day);
      }
    } else {
      fechaProcesada = new Date();
    }
    
    // Crear nuevo ingreso
    const ingreso = new Ingreso({ 
      fecha: fechaProcesada,
      tipo, 
      descripcion: descripcion.trim(), 
      monto: parseFloat(monto), 
      medioPago: medioPago || 'Efectivo', 
      destino: destino || 'Efectivo',
      observacion: observacion ? observacion.trim() : ''
    });
    
    await ingreso.save();
    console.log(`✅ Ingreso creado: ${ingreso.descripcion} - S/ ${ingreso.monto}`);
    console.log(`📅 Fecha: ${formatearFechaConHora(ingreso.fecha)}`);
    res.redirect('/ingresos');
    
  } catch (error) {
    console.error('❌ Error al crear ingreso:', error);
    
    if (error.name === 'ValidationError') {
      const mensajes = Object.values(error.errors).map(err => err.message);
      return res.status(400).send(`Error de validación: ${mensajes.join(', ')}`);
    }
    
    res.status(500).send('Error al crear ingreso');
  }
};



// ============================================
// 5. MOSTRAR FORMULARIO DE EDICIÓN
// ============================================
exports.showEditForm = async (req, res) => {
  try {
    const ingreso = await Ingreso.findById(req.params.id);
    
    if (!ingreso) {
      return res.status(404).send('Ingreso no encontrado');
    }
    
    res.render('ingresoForm', { 
      title: 'Editar Ingreso', 
      ingreso 
    });
    
  } catch (error) {
    console.error('❌ Error al cargar formulario de edición:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).send('ID de ingreso inválido');
    }
    
    res.status(500).send('Error al cargar el formulario de edición');
  }
};

// ============================================
// 6. ACTUALIZAR UN INGRESO
// ============================================
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      fecha, 
      hora,
      tipo, 
      descripcion, 
      monto, 
      medioPago, 
      destino, 
      observacion 
    } = req.body;
    
    // Validaciones
    if (!tipo || !descripcion || !monto) {
      return res.status(400).send('Los campos Tipo, Descripción y Monto son obligatorios');
    }
    
    if (parseFloat(monto) <= 0) {
      return res.status(400).send('El monto debe ser mayor a 0');
    }
    
    // 🔧 PROCESAR FECHA Y HORA COMBINADAS
    let fechaProcesada;
    if (fecha) {
      const [year, month, day] = fecha.split('-').map(Number);
      
      if (hora) {
        const [hours, minutes] = hora.split(':').map(Number);
        fechaProcesada = new Date(year, month - 1, day, hours, minutes);
      } else {
        fechaProcesada = new Date(year, month - 1, day);
      }
    } else {
      fechaProcesada = new Date();
    }
    
    // Actualizar ingreso
    const ingresoActualizado = await Ingreso.findByIdAndUpdate(
      id,
      { 
        fecha: fechaProcesada,
        tipo, 
        descripcion: descripcion.trim(), 
        monto: parseFloat(monto), 
        medioPago: medioPago || 'Efectivo', 
        destino: destino || 'Efectivo',
        observacion: observacion ? observacion.trim() : ''
      },
      { 
        new: true,
        runValidators: true
      }
    );
    
    if (!ingresoActualizado) {
      return res.status(404).send('Ingreso no encontrado');
    }
    
    console.log(`✅ Ingreso actualizado: ${ingresoActualizado.descripcion}`);
    res.redirect('/ingresos');
    
  } catch (error) {
    console.error('❌ Error al actualizar ingreso:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).send('ID de ingreso inválido');
    }
    
    if (error.name === 'ValidationError') {
      const mensajes = Object.values(error.errors).map(err => err.message);
      return res.status(400).send(`Error de validación: ${mensajes.join(', ')}`);
    }
    
    res.status(500).send('Error al actualizar ingreso');
  }
};

// ============================================
// 7. ELIMINAR UN INGRESO
// ============================================
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    
    const ingresoEliminado = await Ingreso.findByIdAndDelete(id);
    
    if (!ingresoEliminado) {
      return res.status(404).send('Ingreso no encontrado');
    }
    
    console.log(`✅ Ingreso eliminado: ${ingresoEliminado.descripcion} - S/ ${ingresoEliminado.monto}`);
    res.redirect('/ingresos');
    
  } catch (error) {
    console.error('❌ Error al eliminar ingreso:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).send('ID de ingreso inválido');
    }
    
    res.status(500).send('Error al eliminar ingreso');
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
    
    // Determinar periodo
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
    
    const estadisticas = await Ingreso.aggregate([
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