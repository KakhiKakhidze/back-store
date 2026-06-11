import { Router } from "express";
import { PurchaseRequisition } from "../models/PurchaseRequisition.js";
import { Item } from "../models/Item.js";
import { Supplier } from "../models/Supplier.js";
import { User } from "../models/User.js";

import { requireRoles } from "../middleware/roleMiddleware.js";

const router = Router();
const allowed = ['PurchasingOfficer', 'DeptHead'];
const FINANCE_THRESHOLD = 5000;

router.get("/", requireRoles(allowed), async (req, res) => {
  try {
    const prs = await PurchaseRequisition.find()
      .populate('created_by', 'full_name')
      .populate('approved_by', 'full_name')
      .sort({ createdAt: -1 });
      
    res.json(prs.map(p => {
      const obj = p.toObject();
      obj.id = obj._id;
      obj.creator_name = obj.created_by?.full_name;
      obj.approver_name = obj.approved_by?.full_name;
      obj.date_created = obj.createdAt;
      return obj;
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", requireRoles(allowed), async (req, res) => {
  try {
    const pr = await PurchaseRequisition.findById(req.params.id)
      .populate('created_by', 'full_name')
      .populate('approved_by', 'full_name')
      .populate('lines.item', 'code name unit_of_measure')
      .populate('lines.suggested_supplier', 'name');
      
    if (!pr) return res.status(404).json({ error: "PR not found" });
    
    const obj = pr.toObject();
    obj.id = obj._id;
    obj.creator_name = obj.created_by?.full_name;
    obj.approver_name = obj.approved_by?.full_name;
    obj.date_created = obj.createdAt;
    
    obj.lines = (obj.lines || []).map(l => ({
      ...l,
      item_id: l.item?._id,
      item_code: l.item?.code,
      item_name: l.item?.name,
      unit_of_measure: l.item?.unit_of_measure,
      supplier_name: l.suggested_supplier?.name
    }));
    
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/auto-generate", requireRoles(['PurchasingOfficer']), async (req, res) => {
  const { created_by } = req.body;
  try {
    const lowItems = await Item.find({
      active: true,
      $expr: { $lte: ["$current_qty", "$reorder_point"] },
      reorder_qty: { $gt: 0 }
    });

    if (lowItems.length === 0) {
      return res.json({ message: "No items below reorder point", generated: 0 });
    }

    const count = await PurchaseRequisition.countDocuments();
    const pr_number = `PR-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;

    let totalEstimated = 0;
    const preferredSupplier = await Supplier.findOne({ preferred: true, active: true });

    const lines = lowItems.map(item => {
      const lineCost = (item.reorder_qty || 0) * (item.unit_cost || 0);
      totalEstimated += lineCost;
      return {
        item: item._id,
        qty_required: item.reorder_qty,
        estimated_unit_cost: item.unit_cost,
        suggested_supplier: preferredSupplier?._id
      };
    });

    const pr = new PurchaseRequisition({
      pr_number,
      status: 'Pending',
      created_by,
      total_estimated: totalEstimated,
      notes: 'Auto-generated from low stock alert',
      lines
    });

    await pr.save();
    res.status(201).json({ id: pr._id, pr_number, items_count: lowItems.length, total_estimated: totalEstimated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/", requireRoles(allowed), async (req, res) => {
  const { created_by, notes, lines } = req.body;
  try {
    const count = await PurchaseRequisition.countDocuments();
    const pr_number = `PR-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;

    let totalEstimated = 0;
    const prLines = lines.map(l => {
      totalEstimated += (l.qty_required || 0) * (l.estimated_unit_cost || 0);
      return {
        item: l.item_id,
        qty_required: l.qty_requested || l.qty_required, // handle both keys if any
        estimated_unit_cost: l.estimated_unit_cost || 0,
        suggested_supplier: l.suggested_supplier_id
      };
    });

    const pr = new PurchaseRequisition({
      pr_number,
      status: 'Pending',
      created_by,
      total_estimated: totalEstimated,
      notes,
      lines: prLines
    });

    await pr.save();
    res.status(201).json({ id: pr._id, pr_number });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/approve", requireRoles(['PurchasingOfficer', 'FinanceController']), async (req, res) => {
  const { approved_by } = req.body;
  try {
    const pr = await PurchaseRequisition.findById(req.params.id);
    if (!pr) return res.status(404).json({ error: "PR not found" });

    if (pr.total_estimated > FINANCE_THRESHOLD) {
      const approver = await User.findById(approved_by);
      if (!approver || !["FinanceController", "GM"].includes(approver.role)) {
        return res.status(403).json({
          error: `PRs exceeding $${FINANCE_THRESHOLD} require Finance Controller or GM approval`,
        });
      }
    }

    pr.status = 'Approved';
    pr.approved_by = approved_by;
    pr.date_approved = new Date();
    await pr.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/reject", requireRoles(['PurchasingOfficer', 'FinanceController']), async (req, res) => {
  const { approved_by, reason } = req.body;
  try {
    const pr = await PurchaseRequisition.findByIdAndUpdate(req.params.id, {
      status: 'Rejected',
      approved_by,
      notes: reason
    }, { new: true });
    if (!pr) return res.status(404).json({ error: "PR not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
