import mongoose from 'mongoose';

const prLineSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  qty_required: { type: Number, required: true },
  estimated_unit_cost: { type: Number, default: 0 },
  suggested_supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
});

const prSchema = new mongoose.Schema({
  pr_number: { type: String, required: true, unique: true },
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Ordered', 'Rejected'],
    default: 'Pending' 
  },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date_approved: Date,
  total_estimated: { type: Number, default: 0 },
  notes: String,
  lines: [prLineSchema]
}, { timestamps: true });

export const PurchaseRequisition = mongoose.model('PurchaseRequisition', prSchema);
