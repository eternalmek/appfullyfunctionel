const { Server } = require('socket.io');

let ioInstance = null;

function initSocket(server, options = {}) {
  if (ioInstance) return ioInstance;
  ioInstance = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_ORIGIN || '*',
      credentials: true
    },
    ...options
  });

  ioInstance.on('connection', (socket) => {
    // optionally authenticate token and join room user:<id>
    socket.on('join', ({ userId }) => {
      if (userId) socket.join(`user:${userId}`);
    });
  });

  return ioInstance;
}

function getIO() {
  if (!ioInstance) throw new Error('Socket.io not initialized');
  return ioInstance;
}

module.exports = { initSocket, getIO };