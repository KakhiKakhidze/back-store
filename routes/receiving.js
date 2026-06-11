import { Router } from "express";
import mongoose from "mongoose";
import { GoodsReceivedNote } from "../models/GoodsReceivedNote.js";
import { PurchaseOrder } from "../models/PurchaseOrder.js";
import { Item } from "../models/Item.js";
import { StockMovement } from "../models/StockMovement.js";

import { requireRoles } from "../middleware/roleMiddleware.js";

const router = Router();
const allowed = ['Storekeeper', 'PurchasingOfficer'];

router.get("/", requireRoles(allowed), async (req, res) => {
  try {
    const grns = await GoodsReceivedNote.find()
      .populate('supplier', 'name')
      .populate('po', 'po_number')
      .populate('received_by', 'full_name')
      .sort({ date_received: -1 });
      
    res.json(grns.map(g => {
      const obj = g.toObject();
      obj.id = obj._id;
      obj.supplier_name = obj.supplier?.name;
      obj.po_number = obj.po?.po_number;
      obj.receiver_name = obj.received_by?.full_name;
      return obj;
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", requireRoles(allowed), async (req, res) => {
  try {
    const grn = await GoodsReceivedNote.findById(req.params.id)
      .populate('supplier', 'name')
      .populate('po', 'po_number')
      .populate('received_by', 'full_name')
      .populate('lines.item', 'code name unit_of_measure');
      
    if (!grn) return res.status(404).json({ error: "GRN not found" });
    
    const obj = grn.toObject();
    obj.id = obj._id;
    obj.supplier_name = obj.supplier?.name;
    obj.po_number = obj.po?.po_number;
    obj.receiver_name = obj.received_by?.full_name;
    
    obj.lines = (obj.lines || []).map(l => ({
      ...l,
      item_id: l.item?._id,
      item_code: l.item?.code,
      item_name: l.item?.name,
      unit_of_measure: l.item?.unit_of_measure
    }));
    
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", requireRoles(allowed), async (req, res) => {
  const { po_id, received_by, notes, lines } = req.body;
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const po = await PurchaseOrder.findById(po_id).session(session);
    if (!po) throw new Error("Purchase Order not found");
    if (po.status === "Draft") throw new Error("PO must be approved before receiving goods");

    const count = await GoodsReceivedNote.countDocuments().session(session);
    const grn_number = `GRN-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;

    const grn = new GoodsReceivedNote({
      grn_number,
      po: po_id,
      supplier: po.supplier,
      received_by,
      status: 'Completed',
      notes,
      lines: lines.map(line => ({
        item: line.item_id,
        po_line_id: line.po_line_id,
        qty_received: line.qty_received,
        unit_price: line.unit_price,
        batch_number: line.batch_number,
        expiry_date: line.expiry_date,
        storage_condition: line.storage_condition
      }))
    });

    await grn.save({ session });

    for (const line of lines) {
      // Update PO line qty_received
      if (line.po_line_id) {
        const poLine = po.lines.id(line.po_line_id);
        if (poLine) {
          poLine.qty_received = (poLine.qty_received || 0) + line.qty_received;
        }
      }

      // Update item current_qty
      const item = await Item.findById(line.item_id).session(session);
      if (item) {
        item.current_qty += line.qty_received;
        await item.save({ session });

        // Create stock movement
        const movement = new StockMovement({
          item: line.item_id,
          movement_type: 'Receipt',
          qty: line.qty_received,
          balance_after: item.current_qty,
          reference_type: 'GRN',
          reference_id: grn._id,
          performed_by: received_by,
          notes: `${grn_number} received`
        });
        await movement.save({ session });
      }
    }

    // Update PO status
    const allReceived = po.lines.every(l => (l.qty_received || 0) >= l.qty_ordered);
    po.status = allReceived ? "Received" : "PartiallyReceived";
    await po.save({ session });

    await session.commitTransaction();
    res.status(201).json({ id: grn._id, grn_number });
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

export default router;
