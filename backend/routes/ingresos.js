const express = require('express');
const router = express.Router();
const ingresoController = require('../controllers/ingresoController');

// API (búsqueda en tiempo real)
router.get('/api', ingresoController.apiList);

// CRUD
router.get('/', ingresoController.list);
router.get('/nuevo', ingresoController.showNewForm);
router.post('/', ingresoController.create);
router.get('/:id/editar', ingresoController.showEditForm);
router.put('/:id', ingresoController.update);
router.delete('/:id', ingresoController.delete);

// Estadísticas (opcional)
router.get('/estadisticas', ingresoController.getEstadisticas);

module.exports = router;