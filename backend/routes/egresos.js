const express = require('express');
const router = express.Router();
const egresoController = require('../controllers/egresoController');

// API (búsqueda en tiempo real)
router.get('/api', egresoController.apiList);

// CRUD
router.get('/', egresoController.list);
router.get('/nuevo', egresoController.showNewForm);
router.post('/', egresoController.create);
router.get('/:id/editar', egresoController.showEditForm);
router.put('/:id', egresoController.update);
router.delete('/:id', egresoController.delete);

// Estadísticas (opcional)
router.get('/estadisticas', egresoController.getEstadisticas);

module.exports = router;