import { Router } from "express";
import mongoose from "mongoose";
import { StockTake } from "../models/StockTake.js";
import { Item } from "../models/Item.js";
import { StockMovement } from "../models/StockMovement.js";

import { requireRoles } from "../middleware/roleMiddleware.js";

const router = Router();
const allowed = ['Storekeeper'];

router.get("/", requireRoles(allowed), async (req, res) => {
  try {
    const takes = await StockTake.find()
      .populate('performed_by', 'full_name')
      .populate('approved_by', 'full_name')
      .sort({ date_started: -1 });
      
    res.json(takes.map(st => {
      const obj = st.toObject();
      obj.id = obj._id;
      obj.performer_name = obj.performed_by?.full_name;
      obj.approver_name = obj.approved_by?.full_name;
      obj.item_count = st.items?.length || 0;
      obj.variance_count = st.items?.filter(i => i.variance && i.variance !== 0).length || 0;
      return obj;
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", requireRoles(allowed), async (req, res) => {
  try {
    const take = await StockTake.findById(req.params.id)
      .populate('performed_by', 'full_name')
      .populate('items.item', 'code name unit_of_measure location_bin current_qty');
      
    if (!take) return res.status(404).json({ error: "Stock take not found" });
    
    const obj = take.toObject();
    obj.id = obj._id;
    obj.performer_name = obj.performed_by?.full_name;
    
    obj.items = (obj.items || []).map(sti => ({
      ...sti,
      id: sti._id,
      item_id: sti.item?._id,
      item_code: sti.item?.code,
      item_name: sti.item?.name,
      unit_of_measure: sti.item?.unit_of_measure,
      location_bin: sti.item?.location_bin
    })).sort((a, b) => (a.item_code || '').localeCompare(b.item_code || ''));
    
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", requireRoles(allowed), async (req, res) => {
  const { count_type, performed_by, category_id, notes } = req.body;
  try {
    const count = await StockTake.countDocuments();
    const reference = `ST-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;

    let itemQuery = { active: true };
    if (count_type === "Cycle" && category_id) {
      itemQuery.category = category_id;
    }

    const items = await Item.find(itemQuery);
    
    const stockTake = new StockTake({
      reference,
      count_type: count_type || "Full",
      status: 'InProgress',
      performed_by,
      notes,
      items: items.map(i => ({
        item: i._id,
        system_qty: i.current_qty
      }))
    });

    await stockTake.save();
    res.status(201).json({ id: stockTake._id, reference, item_count: items.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id/count", requireRoles(allowed), async (req, res) => {
  const { counts } = req.body;
  try {
    const take = await StockTake.findById(req.params.id);
    if (!take) return res.status(404).json({ error: "Stock take not found" });

    counts.forEach(c => {
      const item = take.items.id(c.id);
      if (item) {
        item.physical_qty = c.physical_qty;
        item.variance = c.physical_qty - item.system_qty;
        item.notes = c.notes || null;
      }
    });

    await take.save();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/complete", requireRoles(allowed), async (req, res) => {
  const { approved_by, apply_adjustments } = req.body;
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const take = await StockTake.findById(req.params.id).session(session);
    if (!take) throw new Error("Stock take not found");

    if (apply_adjustments) {
      for (const v of take.items) {
        if (v.variance !== undefined && v.variance !== 0) {
          const item = await Item.findById(v.item).session(session);
          item.current_qty = v.physical_qty;
          await item.save({ session });

          const movement = new StockMovement({
            item: item._id,
            movement_type: 'Adjustment',
            qty: v.variance,
            balance_after: item.current_qty,
            reference_type: 'ST',
            reference_id: take._id,
            performed_by: approved_by,
            notes: `Stock take ${take.reference} adjustment`
          });
          await movement.save({ session });
        }
      }
    }

    take.status = 'Completed';
    take.date_completed = new Date();
    take.approved_by = approved_by;
    await take.save({ session });

    await session.commitTransaction();
    res.json({ success: true });
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

export default router;
