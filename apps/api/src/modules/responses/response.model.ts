import mongoose, { Schema } from 'mongoose';

const responseSchema = new Schema(
  {
    requestPayload: { type: Schema.Types.Mixed, required: true },
    statusCode: { type: Number, default: null },
    ok: { type: Boolean, required: true },
    durationMs: { type: Number, required: true },
    responseBody: { type: Schema.Types.Mixed, default: null },
    responseSize: { type: Number, required: true },
    error: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

responseSchema.index({ createdAt: -1 });

export const ResponseModel = mongoose.model('Response', responseSchema);
