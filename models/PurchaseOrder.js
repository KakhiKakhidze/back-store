import mongoose from 'mongoose';

const poLineSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  qty_ordered: { type: Number, required: true },
  unit_price: { type: Number, required: true },
  qty_received: { type: Number, default: 0 },
});

const poSchema = new mongoose.Schema({
  po_number: { type: String, required: true, unique: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  status: { 
    type: String, 
    enum: ['Draft', 'Approved', 'PartiallyReceived', 'Received', 'Closed'],
    default: 'Draft' 
  },
  total_amount: { type: Number, default: 0 },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date_approved: Date,
  notes: String,
  tender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tender' },
}, { timestamps: true });

poSchema.add({ lines: [poLineSchema] });

export const PurchaseOrder = mongoose.model('PurchaseOrder', poSchema);
