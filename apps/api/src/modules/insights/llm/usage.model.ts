import mongoose, { Schema } from 'mongoose';

const llmUsageSchema = new Schema(
  {
    purpose: { type: String, enum: ['chat', 'incident', 'analysis'], required: true },
    tokensIn: { type: Number, required: true },
    tokensOut: { type: Number, required: true },
    costUsd: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

llmUsageSchema.index({ createdAt: -1 });

export const LlmUsageModel = mongoose.model('LlmUsage', llmUsageSchema);
