import mongoose from 'mongoose';

const grnLineSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  po_line_id: String, // Keep the reference for PO tracking if needed
  qty_received: { type: Number, required: true },
  unit_price: { type: Number, required: true },
  batch_number: String,
  expiry_date: Date,
  storage_condition: String,
});

const gnSchema = new mongoose.Schema({
  grn_number: { type: String, required: true, unique: true },
  po: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  date_received: { type: Date, default: Date.now },
  received_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { 
    type: String, 
    enum: ['Completed', 'Partial', 'Disputed'],
    default: 'Completed' 
  },
  notes: String,
  lines: [grnLineSchema]
}, { timestamps: true });

export const GoodsReceivedNote = mongoose.model('GoodsReceivedNote', gnSchema);
