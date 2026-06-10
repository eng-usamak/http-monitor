import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';

export function createSocket(): Socket {
  return io(API_URL, { transports: ['websocket', 'polling'] });
}
