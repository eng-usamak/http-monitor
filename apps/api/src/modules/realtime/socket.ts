import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { config } from '../../config.js';
import { onResponseCreated } from '../../lib/events.js';
import { logger } from '../../lib/logger.js';

export function attachRealtime(server: HttpServer): Server {
  const io = new Server(server, {
    cors: { origin: config.corsOrigin },
  });

  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id }, 'client connected');
  });

  onResponseCreated((record) => {
    io.emit('response:new', record);
  });

  return io;
}
