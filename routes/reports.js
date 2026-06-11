import { Router } from "express";
import { StockMovement } from "../models/StockMovement.js";
import { Item } from "../models/Item.js";
import { Category } from "../models/Category.js";
import { StoreRequisition } from "../models/StoreRequisition.js";
import { GoodsReceivedNote } from "../models/GoodsReceivedNote.js";
import { Tender } from "../models/Tender.js";
import { Supplier } from "../models/Supplier.js";
import { PurchaseOrder } from "../models/PurchaseOrder.js";

import { requireRoles } from "../middleware/roleMiddleware.js";

const router = Router();
const allowed = ['FinanceController'];

router.get("/stock-movement", requireRoles(allowed), async (req, res) => {
  const { from, to } = req.query;
  try {
    let query = {};
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    }
    
    const movements = await StockMovement.find(query)
      .populate('item', 'code name unit_of_measure')
      .populate('performed_by', 'full_name')
      .sort({ createdAt: -1 });
      
    res.json(movements.map(sm => ({
      ...sm.toObject(),
      item_code: sm.item?.code,
      item_name: sm.item?.name,
      unit_of_measure: sm.item?.unit_of_measure,
      performer_name: sm.performed_by?.full_name,
      date: sm.createdAt
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/stock-valuation", requireRoles(allowed), async (req, res) => {
  try {
    const categories = await Category.find();
    const rows = await Promise.all(categories.map(async (c) => {
      const items = await Item.find({ category: c._id, active: true });
      const total_value = items.reduce((sum, i) => sum + (i.current_qty * i.unit_cost), 0);
      return {
        category: c.name,
        item_count: items.length,
        total_value
      };
    }));
    
    rows.sort((a, b) => b.total_value - a.total_value);
    const grand_total = rows.reduce((s, r) => s + r.total_value, 0);
    res.json({ rows, grand_total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/slow-moving", requireRoles(allowed), async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const cutoff = new Date(Date.now() - days * 86400000);
  
  try {
    const items = await Item.find({ active: true }).populate('category');
    
    const result = await Promise.all(items.map(async (item) => {
      const lastMovement = await StockMovement.findOne({ item: item._id })
        .sort({ createdAt: -1 });
        
      if (!lastMovement || lastMovement.createdAt < cutoff) {
        return {
          ...item.toObject(),
          category_name: item.category?.name,
          last_movement: lastMovement?.createdAt || null
        };
      }
      return null;
    }));
    
    const slowItems = result.filter(i => i !== null).sort((a, b) => (a.last_movement || 0) - (b.last_movement || 0));
    res.json({ days, count: slowItems.length, items: slowItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/expiry", requireRoles(allowed), async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const today = new Date();
  const limitDate = new Date();
  limitDate.setDate(today.getDate() + days);
  
  try {
    const grns = await GoodsReceivedNote.find({
      'lines.expiry_date': { $gte: today, $lte: limitDate }
    }).populate('lines.item', 'code name');
    
    const items = [];
    grns.forEach(g => {
      g.lines.forEach(l => {
        if (l.expiry_date >= today && l.expiry_date <= limitDate) {
          const msec = l.expiry_date.getTime() - today.getTime();
          items.push({
            batch_number: l.batch_number,
            expiry_date: l.expiry_date,
            qty_received: l.qty_received,
            storage_condition: l.storage_condition,
            item_code: l.item?.code,
            item_name: l.item?.name,
            grn_number: g.grn_number,
            days_until_expiry: Math.floor(msec / (1000 * 60 * 60 * 24))
          });
        }
      });
    });
    
    items.sort((a, b) => a.expiry_date - b.expiry_date);
    res.json({ days, count: items.length, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/department-consumption", requireRoles(['FinanceController', 'DeptHead']), async (req, res) => {
  const { from, to, department_id } = req.query;
  try {
    let query = { status: 'Issued' };
    if (department_id) query.department = department_id;
    if (from || to) {
      query.date_issued = {};
      if (from) query.date_issued.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        query.date_issued.$lte = toDate;
      }
    }
    
    const srfs = await StoreRequisition.find(query)
      .populate('department', 'name')
      .populate('lines.item');
      
    const consumption = {};
    srfs.forEach(srf => {
      const deptName = srf.department?.name || 'Unknown';
      srf.lines.forEach(l => {
        const itemId = String(l.item?._id);
        const key = `${deptName}_${itemId}`;
        if (!consumption[key]) {
          consumption[key] = {
            department: deptName,
            item_code: l.item?.code,
            item_name: l.item?.name,
            unit_of_measure: l.item?.unit_of_measure,
            total_qty: 0,
            total_cost: 0
          };
        }
        consumption[key].total_qty += l.qty_issued;
        consumption[key].total_cost += l.qty_issued * (l.item?.unit_cost || 0);
      });
    });
    
    const rows = Object.values(consumption).sort((a, b) => b.total_cost - a.total_cost);
    const total_cost = rows.reduce((s, r) => s + r.total_cost, 0);
    res.json({ rows, total_cost });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper for variance
router.get("/variance", requireRoles(allowed), async (req, res) => {
  try {
    const takes = await StockTake.find({ 'items.variance': { $ne: 0, $exists: true } })
      .populate('items.item', 'code name unit_of_measure');
      
    const rows = [];
    takes.forEach(t => {
      t.items.forEach(i => {
        if (i.variance && i.variance !== 0) {
          rows.push({
            reference: t.reference,
            date_started: t.date_started,
            date_completed: t.date_completed,
            status: t.status,
            ...i.toObject(),
            item_code: i.item?.code,
            item_name: i.item?.name,
            unit_of_measure: i.item?.unit_of_measure
          });
        }
      });
    });
    
    rows.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/tender", requireRoles(['FinanceController', 'PurchasingOfficer']), async (req, res) => {
  try {
    const tenders = await Tender.find()
      .populate('created_by', 'full_name')
      .populate('winner_supplier', 'name')
      .sort({ createdAt: -1 });
      
    const result = await Promise.all(tenders.map(async (t) => {
      const po = await PurchaseOrder.findOne({ tender_id: t._id });
      return {
        ...t.toObject(),
        creator_name: t.created_by?.full_name,
        winner_name: t.winner_supplier?.name,
        bid_count: t.bids?.length || 0,
        invited_count: t.invited_suppliers?.length || 0,
        generated_po_number: po?.po_number,
        po_amount: po?.total_amount,
        date_created: t.createdAt
      };
    }));
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/supplier-performance", requireRoles(['FinanceController', 'PurchasingOfficer']), async (req, res) => {
  try {
    const suppliers = await Supplier.find({ active: true });
    const performance = await Promise.all(suppliers.map(async (s) => {
      const pos = await PurchaseOrder.find({ supplier: s._id });
      const grns = await GoodsReceivedNote.find({ supplier: s._id });
      
      const total_spend = pos.reduce((sum, p) => sum + p.total_amount, 0);
      const completed_pos = pos.filter(p => p.status === 'Received' || p.status === 'Closed').length;
      
      return {
        id: s._id,
        name: s.name,
        lead_time_days: s.lead_time_days,
        preferred: s.preferred,
        total_pos: pos.length,
        total_spend,
        completed_pos,
        total_grns: grns.length
      };
    }));
    
    performance.sort((a, b) => b.total_spend - a.total_spend);
    res.json(performance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
