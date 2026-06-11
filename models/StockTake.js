import mongoose from 'mongoose';

const stockTakeItemSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  system_qty: { type: Number, required: true },
  physical_qty: Number,
  variance: Number,
  notes: String,
});

const stockTakeSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true },
  count_type: { 
    type: String, 
    enum: ['Full', 'Cycle'],
    default: 'Full' 
  },
  status: { 
    type: String, 
    enum: ['InProgress', 'Completed'],
    default: 'InProgress' 
  },
  date_started: { type: Date, default: Date.now },
  date_completed: Date,
  performed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: String,
  items: [stockTakeItemSchema]
}, { timestamps: true });

export const StockTake = mongoose.model('StockTake', stockTakeSchema);
