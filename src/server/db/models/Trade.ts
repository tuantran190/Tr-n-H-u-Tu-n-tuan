import mongoose from 'mongoose';

const TradeSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  direction: { type: String, required: true, enum: ['LONG', 'SHORT'] },
  entryPrice: { type: Number, required: true },
  exitPrice: { type: Number, default: null },
  amount: { type: Number, required: true },
  status: { type: String, required: true, enum: ['OPEN', 'CLOSED', 'FAILED'] },
  profit: { type: Number, default: null },
  openedAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null },
  aiConfidence: { type: Number, default: null },
  aiSignal: { type: Object, default: null }, // Store raw probabilities and EMA info
}, { timestamps: true });

export const TradeModel = mongoose.model('Trade', TradeSchema);
