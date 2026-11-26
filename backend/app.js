process.env.TZ = 'America/Lima'; // Perú (UTC-5)
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');

// ========================================

dotenv.config();

const app = express();

// ========================================
// 🔧 SOLUCIÓN 2: Conectar MongoDB con opciones
// ========================================
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ Conectado a MongoDB');
  console.log(`🕐 Zona horaria del servidor: ${process.env.TZ}`);
  console.log(`📅 Hora actual del servidor: ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })}`);
})
.catch(err => console.error('❌ Error de conexión:', err));

// ========================================
// 🔧 SOLUCIÓN 3: Middlewares
// ========================================
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));

// ========================================
// 🔧 SOLUCIÓN 4: Configurar vistas
// ========================================
app.set('views', path.join(__dirname, '../frontend/views'));
app.set('view engine', 'pug');
app.use(express.static(path.join(__dirname, '../frontend/public')));

// ========================================
// 🔧 SOLUCIÓN 5: Helpers para fechas
// ========================================
app.locals.formatDate = function(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

app.locals.formatDateTime = function(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

// ============================================
// HELPER PARA FORMATEAR FECHA PARA INPUT DATE
// ============================================
app.locals.formatDateInput = function(date) {
  if (!date) return '';
  
  const d = new Date(date);
  // Obtener año, mes y día en zona horaria local
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// ========================================
// 🔧 SOLUCIÓN 6: Rutas
// ========================================
const indexRoutes = require('./routes/index');
const ingresoRoutes = require('./routes/ingresos');
const egresoRoutes = require('./routes/egresos');
const cronogramaRoutes = require('./routes/cronograma');
const prestamoRoutes = require('./routes/prestamos');
const pagoServicioRoutes = require('./routes/pagosServicios');


app.use('/', indexRoutes);
app.use('/ingresos', ingresoRoutes);
app.use('/egresos', egresoRoutes);
app.use('/cronograma', cronogramaRoutes);
app.use('/prestamos', prestamoRoutes);
app.use('/pagos-servicios', pagoServicioRoutes);

// ========================================
// 🔧 SOLUCIÓN 7: Manejo de errores
// ========================================
app.use((req, res) => {
  res.status(404).send('❌ Página no encontrada');
});

app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).send('❌ Algo salió mal!');
});

// ========================================
// 🔧 SOLUCIÓN 8: Iniciar servidor
// ========================================
const PORT = process.env.PORT || 3200;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`🕐 Zona horaria: ${process.env.TZ}`);
});