const Prestamo = require('../models/Prestamo');
const PagoServicio = require('../models/PagoServicio');

// ============================================
// DASHBOARD DEL CRONOGRAMA
// ============================================
exports.getDashboard = async (req, res) => {
  try {
    const { mes, anio } = req.query;
    const fechaActual = new Date();
    const mesSeleccionado = mes ? parseInt(mes) : fechaActual.getMonth() + 1;
    const anioSeleccionado = anio ? parseInt(anio) : fechaActual.getFullYear();
    
    // Obtener préstamos activos
    const prestamos = await Prestamo.find({ estado: 'Activo' });
    
    // Obtener pagos de servicios pendientes
    const serviciosPendientes = await PagoServicio.find({ 
      estado: { $in: ['Pendiente', 'Vencido'] }
    });
    
    // Obtener pagos del mes
    const inicioMes = new Date(anioSeleccionado, mesSeleccionado - 1, 1);
    const finMes = new Date(anioSeleccionado, mesSeleccionado, 1);
    
    const prestamosMes = await Prestamo.find({
      fechaInicio: { $gte: inicioMes, $lt: finMes }
    });
    
    const serviciosMes = await PagoServicio.find({
      fechaVencimiento: { $gte: inicioMes, $lt: finMes }
    });
    
    // Calcular totales
    const totalPrestamos = prestamos.reduce((sum, p) => sum + p.saldoPendiente, 0);
    const totalServicios = serviciosPendientes.reduce((sum, s) => sum + s.monto, 0);
    
    res.render('cronograma/index', {
      title: 'Cronograma de Pagos',
      prestamos,
      serviciosPendientes,
      prestamosMes,
      serviciosMes,
      totalPrestamos,
      totalServicios,
      mes: mesSeleccionado,
      anio: anioSeleccionado,
      meses: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    });
    
  } catch (error) {
    console.error('❌ Error en dashboard cronograma:', error);
    res.status(500).send('Error al cargar el cronograma');
  }
};

// ============================================
// OBTENER EVENTOS PARA EL CALENDARIO (API)
// ============================================
exports.getEventos = async (req, res) => {
  try {
    const { mes, anio } = req.query;
    const mesNum = mes ? parseInt(mes) : new Date().getMonth() + 1;
    const anioNum = anio ? parseInt(anio) : new Date().getFullYear();
    
    const inicioMes = new Date(anioNum, mesNum - 1, 1);
    const finMes = new Date(anioNum, mesNum, 1);
    
    // Obtener préstamos del mes
    const prestamos = await Prestamo.find({
      fechaInicio: { $gte: inicioMes, $lt: finMes }
    });
    
    // Obtener servicios del mes
    const servicios = await PagoServicio.find({
      fechaVencimiento: { $gte: inicioMes, $lt: finMes }
    });
    
    // Formatear eventos para el calendario
    const eventos = [];
    
    prestamos.forEach(p => {
      eventos.push({
        id: p._id,
        title: `💰 ${p.nombre}`,
        fecha: p.fechaInicio,
        tipo: 'prestamo',
        monto: p.montoTotal,
        estado: p.estado,
        saldo: p.saldoPendiente,
        entidad: p.entidad
      });
    });
    
    servicios.forEach(s => {
      eventos.push({
        id: s._id,
        title: `📋 ${s.nombre}`,
        fecha: s.fechaVencimiento,
        tipo: 'servicio',
        monto: s.monto,
        estado: s.estado,
        categoria: s.categoria
      });
    });
    
    res.json({
      success: true,
      eventos
    });
    
  } catch (error) {
    console.error('❌ Error al obtener eventos:', error);
    res.status(500).json({ success: false, error: 'Error al obtener eventos' });
  }
};