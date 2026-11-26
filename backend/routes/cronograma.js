const express = require('express');
const router = express.Router();
const cronogramaController = require('../controllers/cronogramaController');

router.get('/', cronogramaController.getDashboard);
router.get('/api/eventos', cronogramaController.getEventos);

module.exports = router;