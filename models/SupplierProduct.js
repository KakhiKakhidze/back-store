import mongoose from 'mongoose';

const supplierProductSchema = new mongoose.Schema({
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
  code: { type: String, required: true },           // supplier's own SKU
  name: { type: String, required: true },
  unit_of_measure: { type: String, required: true },
  default_unit_price: { type: Number, default: 0 },
  description: String,
  category: String,                                  // free-form supplier category
  linked_item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' }, // optional inventory link
  active: { type: Boolean, default: true },
}, { timestamps: true });

// Each supplier's catalog must have unique codes within their own catalog.
supplierProductSchema.index({ supplier: 1, code: 1 }, { unique: true });

export const SupplierProduct = mongoose.model('SupplierProduct', supplierProductSchema);
