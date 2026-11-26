const Ingreso = require('../models/Ingresos');
const Egreso = require('../models/Egresos');
const Prestamo = require('../models/Prestamo');
const PagoServicio = require('../models/PagoServicio');

function getDateFilter(periodo, req) {
  const now = new Date();
  let start, end;

  switch (periodo) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      break;
    case 'week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(now.getFullYear(), now.getMonth(), diff);
      end = new Date(now.getFullYear(), now.getMonth(), diff + 7);
      break;
    }
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    case 'previousMonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear() + 1, 0, 1);
      break;
    case 'custom':
      start = req.query.fechaInicio ? new Date(req.query.fechaInicio) : new Date(0);
      end = req.query.fechaFin ? new Date(req.query.fechaFin) : new Date();
      end.setHours(23, 59, 59, 999);
      break;
    default:
      return null;
  }
  return { $gte: start, $lt: end };
}

exports.getDashboard = async (req, res) => {
  try {
    const periodo = req.query.periodo || 'month';
    const filtroFecha = getDateFilter(periodo, req);

    const matchIngreso = filtroFecha ? { fecha: filtroFecha } : {};
    const matchEgreso = filtroFecha ? { fecha: filtroFecha } : {};

    // Totales del periodo
    const totalIngresos = await Ingreso.aggregate([
      { $match: matchIngreso },
      { $group: { _id: null, total: { $sum: '$monto' } } }
    ]);
    const totalEgresos = await Egreso.aggregate([
      { $match: matchEgreso },
      { $group: { _id: null, total: { $sum: '$monto' } } }
    ]);

    const ingTotal = totalIngresos.length ? totalIngresos[0].total : 0;
    const egTotal = totalEgresos.length ? totalEgresos[0].total : 0;
    const resultado = ingTotal - egTotal;

    // Saldo total histórico
    const totalIngresosHist = await Ingreso.aggregate([{ $group: { _id: null, total: { $sum: '$monto' } } }]);
    const totalEgresosHist = await Egreso.aggregate([{ $group: { _id: null, total: { $sum: '$monto' } } }]);
    const ingHist = totalIngresosHist.length ? totalIngresosHist[0].total : 0;
    const egHist = totalEgresosHist.length ? totalEgresosHist[0].total : 0;
    const saldoTotal = ingHist - egHist;

    // Últimos 10 movimientos
    const ingresos = await Ingreso.find(matchIngreso).sort({ fecha: -1 }).limit(10);
    const egresos = await Egreso.find(matchEgreso).sort({ fecha: -1 }).limit(10);
    
    let movimientos = [
      ...ingresos.map(i => ({ 
        ...i.toObject(), 
        tipoMovimiento: 'ingreso',
        destino: i.destino || 'No especificado'
      })),
      ...egresos.map(e => ({ 
        ...e.toObject(), 
        tipoMovimiento: 'egreso',
        origen: e.origen || 'No especificado'
      }))
    ];
    movimientos.sort((a, b) => b.fecha - a.fecha);
    movimientos = movimientos.slice(0, 10);

    // Datos para gráfico de barras (últimos 6 meses)
    const labels = [];
    const ingresosMensuales = [];
    const egresosMensuales = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const mes = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mesFin = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      labels.push(mes.toLocaleString('default', { month: 'short' }));

      const ingMensual = await Ingreso.aggregate([
        { $match: { fecha: { $gte: mes, $lt: mesFin } } },
        { $group: { _id: null, total: { $sum: '$monto' } } }
      ]);
      const egMensual = await Egreso.aggregate([
        { $match: { fecha: { $gte: mes, $lt: mesFin } } },
        { $group: { _id: null, total: { $sum: '$monto' } } }
      ]);
      ingresosMensuales.push(ingMensual.length ? ingMensual[0].total : 0);
      egresosMensuales.push(egMensual.length ? egMensual[0].total : 0);
    }

    // Distribución de egresos (para el periodo filtrado)
    const distribucionEgresos = await Egreso.aggregate([
      { $match: matchEgreso },
      { $group: { _id: '$categoria', total: { $sum: '$monto' } } },
      { $sort: { total: -1 } }
    ]);

    // Datos del cronograma (resumen)
    const prestamosActivos = await Prestamo.find({ estado: 'Activo' });
    const serviciosPendientes = await PagoServicio.find({ 
      estado: { $in: ['Pendiente', 'Vencido'] }
    });
    
    const totalPrestamos = prestamosActivos.reduce((sum, p) => sum + p.saldoPendiente, 0);
    const totalServicios = serviciosPendientes.reduce((sum, s) => sum + s.monto, 0);

    res.render('dashboard', {
      title: 'Dashboard',
      totalIngresos: ingTotal,
      totalEgresos: egTotal,
      resultado,
      saldoTotal,
      movimientos,
      labels,
      ingresosMensuales,
      egresosMensuales,
      distribucion: distribucionEgresos,
      periodo,
      fechaInicio: req.query.fechaInicio || '',
      fechaFin: req.query.fechaFin || '',
      // Datos del cronograma
      totalPrestamos,
      totalServicios,
      prestamosActivos: prestamosActivos.length,
      serviciosPendientes: serviciosPendientes.length
    });
    
  } catch (error) {
    console.error('❌ Error en el dashboard:', error);
    res.status(500).send('Error en el dashboard');
  }
};