import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  contact_person: String,
  phone: String,
  email: String,
  address: String,
  lead_time_days: { type: Number, default: 3 },
  preferred: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
}, { timestamps: true });

export const Supplier = mongoose.model('Supplier', supplierSchema);
