import mongoose from 'mongoose';

const srfLineSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  qty_requested: { type: Number, required: true },
  qty_issued: { type: Number, default: 0 },
});

const srfSchema = new mongoose.Schema({
  srf_number: { type: String, required: true, unique: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  requested_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorized_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date_requested: { type: Date, default: Date.now },
  date_issued: Date,
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Issued', 'Rejected'],
    default: 'Pending' 
  },
  notes: String,
  lines: [srfLineSchema]
}, { timestamps: true });

export const StoreRequisition = mongoose.model('StoreRequisition', srfSchema);
