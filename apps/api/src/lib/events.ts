import { EventEmitter } from 'node:events';
import type { IncidentRecord } from '../modules/insights/incidents/incident.types.js';
import type { ResponseRecord } from '../modules/responses/response.types.js';

// In-process event bus decoupling ingestion from realtime broadcasting.
// In a worker+API split this becomes Redis pub/sub or a Mongo change stream.
const bus = new EventEmitter();

const RESPONSE_CREATED = 'response.created';
const INCIDENT_CREATED = 'incident.created';

export function emitResponseCreated(record: ResponseRecord): void {
  bus.emit(RESPONSE_CREATED, record);
}

export function onResponseCreated(handler: (record: ResponseRecord) => void): void {
  bus.on(RESPONSE_CREATED, handler);
}

export function emitIncidentCreated(incident: IncidentRecord): void {
  bus.emit(INCIDENT_CREATED, incident);
}

export function onIncidentCreated(handler: (incident: IncidentRecord) => void): void {
  bus.on(INCIDENT_CREATED, handler);
}
