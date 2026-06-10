import mongoose, { Schema } from 'mongoose';

const incidentSchema = new Schema(
  {
    responseId: { type: String, required: true },
    endpoint: { type: String, required: true },
    severity: { type: String, enum: ['warning', 'critical'], required: true },
    durationMs: { type: Number, required: true },
    baselineAvgMs: { type: Number, required: true },
    ratio: { type: Number, required: true },
    summary: { type: String, required: true },
    rootCauses: { type: [String], default: [] },
    recommendations: { type: [String], default: [] },
    llmGenerated: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

incidentSchema.index({ createdAt: -1 });

export const IncidentModel = mongoose.model('Incident', incidentSchema);
