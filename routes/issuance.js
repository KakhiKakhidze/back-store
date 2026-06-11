import { Router } from "express";
import mongoose from "mongoose";
import { StoreRequisition } from "../models/StoreRequisition.js";
import { Item } from "../models/Item.js";
import { User } from "../models/User.js";
import { StockMovement } from "../models/StockMovement.js";

import { requireRoles } from "../middleware/roleMiddleware.js";

const router = Router();
const allowed = ['Storekeeper', 'DeptHead'];

router.get("/", requireRoles(allowed), async (req, res) => {
  try {
    const srfs = await StoreRequisition.find()
      .populate('department')
      .populate('requested_by', 'full_name')
      .populate('authorized_by', 'full_name')
      .sort({ date_requested: -1 });
      
    res.json(srfs.map(s => {
      const obj = s.toObject();
      obj.id = obj._id;
      obj.department_name = obj.department?.name;
      obj.department_code = obj.department?.code;
      obj.requester_name = obj.requested_by?.full_name;
      obj.authorizer_name = obj.authorized_by?.full_name;
      return obj;
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", requireRoles(allowed), async (req, res) => {
  try {
    const srf = await StoreRequisition.findById(req.params.id)
      .populate('department')
      .populate('requested_by', 'full_name')
      .populate('authorized_by', 'full_name')
      .populate('lines.item');
      
    if (!srf) return res.status(404).json({ error: "SRF not found" });
    
    const obj = srf.toObject();
    obj.id = obj._id;
    obj.department_name = obj.department?.name;
    obj.department_code = obj.department?.code;
    obj.requester_name = obj.requested_by?.full_name;
    obj.authorizer_name = obj.authorized_by?.full_name;
    
    obj.lines = (obj.lines || []).map(l => ({
      ...l,
      item_id: l.item?._id,
      item_code: l.item?.code,
      item_name: l.item?.name,
      unit_of_measure: l.item?.unit_of_measure,
      current_qty: l.item?.current_qty,
      unit_cost: l.item?.unit_cost,
      is_controlled: l.item?.is_controlled
    }));
    
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", requireRoles(allowed), async (req, res) => {
  const { department_id, requested_by, notes, lines } = req.body;
  try {
    const count = await StoreRequisition.countDocuments();
    const srf_number = `SRF-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;

    const srf = new StoreRequisition({
      srf_number,
      department: department_id,
      requested_by,
      status: 'Pending',
      notes,
      lines: lines.map(l => ({
        item: l.item_id,
        qty_requested: l.qty_requested
      }))
    });

    await srf.save();
    res.status(201).json({ id: srf._id, srf_number });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/approve", requireRoles(allowed), async (req, res) => {
  const { authorized_by } = req.body;
  try {
    const srf = await StoreRequisition.findById(req.params.id).populate('lines.item');
    if (!srf) return res.status(404).json({ error: "SRF not found" });
    if (srf.status !== "Pending") return res.status(400).json({ error: "SRF is not pending approval" });

    const hasControlled = srf.lines.some(l => l.item?.is_controlled);
    if (hasControlled) {
      const authorizer = await User.findById(authorized_by);
      if (!authorizer || !["Storekeeper", "GM", "FinanceController"].includes(authorizer.role)) {
        return res.status(403).json({
          error: "Controlled items require authorization from Storekeeper, Finance Controller, or GM",
        });
      }
    }

    srf.status = 'Approved';
    srf.authorized_by = authorized_by;
    await srf.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/issue", requireRoles(allowed), async (req, res) => {
  const { issued_by } = req.body;
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const srf = await StoreRequisition.findById(req.params.id).populate('lines.item').session(session);
    if (!srf) throw new Error("SRF not found");
    if (srf.status !== "Approved") throw new Error("SRF must be approved before issuing");

    const insufficient = srf.lines.filter(l => (l.item?.current_qty || 0) < l.qty_requested);
    if (insufficient.length > 0) {
      throw new Error(`Insufficient stock for: ${insufficient.map(l => l.item?.name).join(', ')}`);
    }

    for (const line of srf.lines) {
      const item = await Item.findById(line.item._id).session(session);
      item.current_qty -= line.qty_requested;
      await item.save({ session });

      line.qty_issued = line.qty_requested;

      const movement = new StockMovement({
        item: item._id,
        movement_type: 'Issue',
        qty: -line.qty_requested,
        balance_after: item.current_qty,
        reference_type: 'SRF',
        reference_id: srf._id,
        performed_by: issued_by,
        notes: `${srf.srf_number} issued`
      });
      await movement.save({ session });
    }

    srf.status = 'Issued';
    srf.date_issued = new Date();
    await srf.save({ session });

    await session.commitTransaction();
    res.json({ success: true });
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

router.post("/:id/reject", requireRoles(allowed), async (req, res) => {
  const { authorized_by, reason } = req.body;
  try {
    const srf = await StoreRequisition.findByIdAndUpdate(req.params.id, {
      status: 'Rejected',
      authorized_by,
      notes: reason
    }, { new: true });
    if (!srf) return res.status(404).json({ error: "SRF not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
