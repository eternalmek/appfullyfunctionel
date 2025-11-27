require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const http = require('http');
const path = require('path');

const authRoutes = require('./routes/auth');
const memoriesRoutes = require('./routes/memories');
const connectionsRoutes = require('./routes/connections');
const uploadRoutes = require('./routes/upload');
const mirrorRoutes = require('./routes/mirror');
const { initSocket } = require('./socket');

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static health
app.get('/', (req, res) => res.json({ status: 'ok', version: '0.2.0' }));

// Routes
app.use('/auth', authRoutes);
app.use('/memories', memoriesRoutes);
app.use('/connections', connectionsRoutes);
app.use('/upload', uploadRoutes);
app.use('/mirror', mirrorRoutes);

// Health route for readiness
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Serve a tiny static page for OAuth callbacks if needed
app.use('/static', express.static(path.join(__dirname, 'static')));

// Initialize socket.io
const io = initSocket(server);

const PORT = Number(process.env.PORT || 4000);
server.listen(PORT, () => {
  console.log(`EternalMe backend listening on http://localhost:${PORT}`);
});