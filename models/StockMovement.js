import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  movement_type: { 
    type: String, 
    required: true, 
    enum: ['Receipt', 'Issue', 'Return', 'Adjustment', 'Transfer', 'Spoilage'] 
  },
  qty: { type: Number, required: true },
  balance_after: { type: Number, required: true },
  reference_type: String,
  reference_id: String, // Keep as string for flexibility (e.g. ObjectId or legacy ID)
  performed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: String,
}, { timestamps: true });

export const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
