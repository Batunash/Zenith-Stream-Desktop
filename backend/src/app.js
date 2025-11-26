const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { MEDIA_DIR } = require('./config/config');
const mediaRoutes = require('./routes/mediaRoutes');
const watchRoutes = require('./routes/watchRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api', mediaRoutes);
app.use('/api', watchRoutes);
app.use('/images', express.static(MEDIA_DIR));

module.exports = app;
