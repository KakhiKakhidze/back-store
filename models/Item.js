import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  unit_of_measure: { type: String, required: true },
  location_bin: String,
  current_qty: { type: Number, default: 0 },
  min_stock_level: { type: Number, default: 0 },
  reorder_point: { type: Number, default: 0 },
  reorder_qty: { type: Number, default: 0 },
  unit_cost: { type: Number, default: 0 },
  is_perishable: { type: Boolean, default: false },
  is_controlled: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
}, { timestamps: true });

export const Item = mongoose.model('Item', itemSchema);
