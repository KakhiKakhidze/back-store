import mongoose from 'mongoose';

const specialOfferSchema = new mongoose.Schema({
  offer_number: { type: String, required: true, unique: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  supplier_product: { type: mongoose.Schema.Types.ObjectId, ref: 'SupplierProduct', required: true },
  unit_price: { type: Number, required: true },
  qty_offered: { type: Number, required: true },
  valid_until: { type: Date, required: true },
  notes: String,
  status: {
    type: String,
    enum: ['Pending', 'Accepted', 'Rejected', 'Withdrawn', 'Expired'],
    default: 'Pending',
  },
  reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date_reviewed: Date,
  rejection_reason: String,
  po_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' },
}, { timestamps: true });

export const SpecialOffer = mongoose.model('SpecialOffer', specialOfferSchema);
