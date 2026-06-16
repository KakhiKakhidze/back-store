import mongoose from 'mongoose';

const tenderItemSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  qty_required: { type: Number, required: true },
  notes: String,
});

const tenderBidLineSchema = new mongoose.Schema({
  tender_item_id: { type: String, required: true }, // Referencing tenderItemSchema's _id
  unit_price: { type: Number, required: true },
  qty_offered: { type: Number, required: true },
  notes: String,
});

const tenderBidSchema = new mongoose.Schema({
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  submitted_at: { type: Date, default: Date.now },
  total_amount: { type: Number, default: 0 },
  has_vat: { type: Boolean, default: false },
  notes: String,
  lines: [tenderBidLineSchema],
});

const tenderSchema = new mongoose.Schema({
  tender_number: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: String,
  status: { 
    type: String, 
    enum: ['Draft', 'Published', 'Closed', 'Evaluation', 'Awarded', 'Cancelled'],
    default: 'Draft' 
  },
  deadline: { type: Date, required: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  finance_approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  awarded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  winner_supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  date_awarded: Date,
  notes: String,
  items: [tenderItemSchema],
  invited_suppliers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' }],
  bids: [tenderBidSchema],
}, { timestamps: true });

export const Tender = mongoose.model('Tender', tenderSchema);
