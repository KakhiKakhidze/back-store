import { Router } from "express";
import { PurchaseOrder } from "../models/PurchaseOrder.js";
import { Item } from "../models/Item.js";
import { Supplier } from "../models/Supplier.js";
import { User } from "../models/User.js";

import { requireRoles } from "../middleware/roleMiddleware.js";

const router = Router();
const allowed = ['PurchasingOfficer', 'FinanceController', 'Storekeeper'];

router.get("/", requireRoles(allowed), async (req, res) => {
  try {
    const pos = await PurchaseOrder.find()
      .populate('supplier', 'name')
      .populate('created_by', 'full_name')
      .populate('tender_id', 'tender_number')
      .sort({ createdAt: -1 });
    
    res.json(pos.map(po => {
      const obj = po.toObject();
      obj.id = obj._id;
      obj.supplier_name = obj.supplier?.name;
      obj.creator_name = obj.created_by?.full_name;
      obj.tender_number = obj.tender_id?.tender_number;
      obj.date_created = obj.createdAt;
      return obj;
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", requireRoles(allowed), async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id)
      .populate('supplier', 'name')
      .populate('created_by', 'full_name')
      .populate('tender_id', 'tender_number')
      .populate('lines.item', 'code name unit_of_measure');
      
    if (!po) return res.status(404).json({ error: "PO not found" });
    
    const obj = po.toObject();
    obj.id = obj._id;
    obj.supplier_name = obj.supplier?.name;
    obj.creator_name = obj.created_by?.full_name;
    obj.tender_number = obj.tender_id?.tender_number;
    obj.date_created = obj.createdAt;
    
    // Format lines for frontend compatibility
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

router.post("/", requireRoles(['PurchasingOfficer']), async (req, res) => {
  const { supplier, created_by, notes, lines } = req.body;
  try {
    const count = await PurchaseOrder.countDocuments();
    const po_number = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;
    
    let total = 0;
    const poLines = lines.map(l => {
      total += l.qty_ordered * l.unit_price;
      return {
        item: l.item_id,
        qty_ordered: l.qty_ordered,
        unit_price: l.unit_price
      };
    });

    const po = new PurchaseOrder({
      po_number,
      supplier,
      status: 'Draft',
      total_amount: total,
      created_by,
      notes,
      lines: poLines
    });

    await po.save();
    res.status(201).json({ id: po._id, po_number });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/approve", requireRoles(['FinanceController']), async (req, res) => {
  const { approved_by } = req.body;
  try {
    const po = await PurchaseOrder.findByIdAndUpdate(req.params.id, {
      status: 'Approved',
      approved_by,
      date_approved: new Date()
    }, { new: true });
    
    if (!po) return res.status(404).json({ error: "PO not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
