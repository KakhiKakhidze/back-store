import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  full_name: { type: String, required: true },
  role: { 
    type: String, 
    required: true, 
    enum: ['Storekeeper', 'DeptHead', 'PurchasingOfficer', 'FinanceController', 'GM', 'Supplier'] 
  },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  active: { type: Boolean, default: true },
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
