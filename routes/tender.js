import { Router } from "express";
import mongoose from "mongoose";
import { Tender } from "../models/Tender.js";
import { Supplier } from "../models/Supplier.js";
import { User } from "../models/User.js";
import { PurchaseOrder } from "../models/PurchaseOrder.js";

import { requireRoles } from "../middleware/roleMiddleware.js";

const router = Router();
const adminRoles = ['PurchasingOfficer', 'GM'];
const supplierRoles = ['Supplier'];
const financeRoles = ['FinanceController', 'GM'];

// Auto-close any Published tenders whose deadline has passed
async function autoCloseExpiredTenders() {
  try {
    await Tender.updateMany(
      { status: 'Published', deadline: { $lt: new Date() } },
      { $set: { status: 'Closed' } }
    );
  } catch (err) {
    console.error('autoCloseExpiredTenders failed:', err.message);
  }
}

// List all tenders (Admin)
router.get("/", requireRoles(adminRoles), async (req, res) => {
  try {
    await autoCloseExpiredTenders();
    const tenders = await Tender.find()
      .populate('created_by', 'full_name')
      .populate('winner_supplier', 'name')
      .sort({ createdAt: -1 });
      
    res.json(tenders.map(t => {
      const obj = t.toObject();
      obj.id = obj._id;
      obj.creator_name = obj.created_by?.full_name;
      obj.winner_name = obj.winner_supplier?.name;
      obj.date_created = obj.createdAt;
      return obj;
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Portal for suppliers
router.get("/portal", requireRoles(supplierRoles), async (req, res) => {
  try {
    await autoCloseExpiredTenders();
    const tenders = await Tender.find({ status: 'Published' })
      .populate('items.item', 'code name unit_of_measure')
      .sort({ deadline: 1 });

    res.json(tenders.map(t => {
      const obj = t.toObject();
      obj.id = obj._id;
      
      // Calculate anonymous lowest bid
      const lowestBid = t.bids.length > 0 
        ? Math.min(...t.bids.map(b => b.total_amount))
        : null;
      
      return {
        id: obj.id,
        tender_number: obj.tender_number,
        title: obj.title,
        description: obj.description,
        deadline: obj.deadline,
        items: obj.items.map(ti => ({
          id: ti._id,
          item_code: ti.item?.code,
          item_name: ti.item?.name,
          unit_of_measure: ti.item?.unit_of_measure,
          qty_required: ti.qty_required,
          notes: ti.notes
        })),
        lowest_bid: lowestBid
      };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single tender
router.get("/:id", requireRoles([...adminRoles, ...supplierRoles]), async (req, res) => {
  try {
    await autoCloseExpiredTenders();
    const tender = await Tender.findById(req.params.id)
      .populate('created_by', 'full_name')
      .populate('finance_approved_by', 'full_name')
      .populate('awarded_by', 'full_name')
      .populate('winner_supplier', 'name')
      .populate('items.item', 'code name unit_of_measure')
      .populate('invited_suppliers', 'name contact_person phone email')
      .populate('bids.supplier', 'name');
      
    if (!tender) return res.status(404).json({ error: "Tender not found" });
    
    const obj = tender.toObject();
    obj.id = obj._id;
    obj.creator_name = obj.created_by?.full_name;
    obj.finance_approver_name = obj.finance_approved_by?.full_name;
    obj.awarder_name = obj.awarded_by?.full_name;
    obj.winner_name = obj.winner_supplier?.name;
    obj.date_created = obj.createdAt;
    
    // Format items for frontend compatibility
    obj.items = (obj.items || []).map(ti => ({
      ...ti,
      id: String(ti._id),
      item_id: ti.item?._id,
      item_code: ti.item?.code,
      item_name: ti.item?.name,
      unit_of_measure: ti.item?.unit_of_measure
    }));

    // Normalize invited suppliers
    obj.invited_suppliers = (obj.invited_suppliers || []).map(s => ({
      id: String(s._id),
      supplier_id: String(s._id),
      supplier_name: s.name,
      contact_person: s.contact_person,
      phone: s.phone,
      email: s.email
    }));

    // Format bids and their lines
    obj.bids = (obj.bids || []).map(bid => {
      const bidLines = (bid.lines || []).map(line => {
        const tenderItem = obj.items.find(i => i.id === String(line.tender_item_id));
        return {
          ...line,
          tender_item_id: String(line.tender_item_id),
          item_id: tenderItem?.item_id,
          item_code: tenderItem?.item_code,
          item_name: tenderItem?.item_name,
          unit_of_measure: tenderItem?.unit_of_measure
        };
      });
      return {
        ...bid,
        id: String(bid._id),
        supplier_id: bid.supplier?._id ? String(bid.supplier._id) : null,
        supplier_name: bid.supplier?.name,
        lines: bidLines
      };
    }).sort((a, b) => a.total_amount - b.total_amount);
    
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create tender
router.post("/", requireRoles([...adminRoles, 'GM']), async (req, res) => {
  const { title, description, deadline, created_by, notes, items, supplier_ids } = req.body;
  if (!title || !deadline || !items?.length) {
    return res.status(400).json({ error: "title, deadline and at least one item required" });
  }

  try {
    const count = await Tender.countDocuments();
    const tender_number = `TND-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;

    const tender = new Tender({
      tender_number,
      title,
      description,
      deadline,
      created_by,
      notes,
      status: 'Published',
      items: items.map(it => ({
        item: it.item_id,
        qty_required: it.qty_required,
        notes: it.notes
      })),
      invited_suppliers: supplier_ids || []
    });

    await tender.save();
    res.status(201).json({ tender_id: tender._id, tender_number });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update tender
router.put("/:id", requireRoles(adminRoles), async (req, res) => {
  const { title, description, deadline, notes, items, supplier_ids } = req.body;
  try {
    const tender = await Tender.findById(req.params.id);
    if (!tender) return res.status(404).json({ error: "Tender not found" });
    
    const age = Date.now() - new Date(tender.createdAt).getTime();
    const isWithinOneHour = age < 60 * 60 * 1000;
    if (["Awarded", "Cancelled"].includes(tender.status) && !isWithinOneHour) {
      return res.status(400).json({ error: `Cannot edit tender in ${tender.status} status` });
    }

    tender.title = title || tender.title;
    tender.description = description !== undefined ? description : tender.description;
    tender.deadline = deadline || tender.deadline;
    tender.notes = notes !== undefined ? notes : tender.notes;
    
    if (items) {
      tender.items = items.map(it => ({
        item: it.item_id,
        qty_required: it.qty_required,
        notes: it.notes
      }));
    }
    
    if (supplier_ids) {
      tender.invited_suppliers = supplier_ids;
    }

    await tender.save();
    res.json({ success: true, tender_number: tender.tender_number });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Renew tender (Clone to a new Draft)
router.post("/:id/renew", requireRoles([...adminRoles, 'GM']), async (req, res) => {
  try {
    const oldTender = await Tender.findById(req.params.id);
    if (!oldTender) return res.status(404).json({ error: "Tender not found" });

    const count = await Tender.countDocuments();
    const tender_number = `TND-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;

    const newTender = new Tender({
      tender_number,
      title: `განახლებული: ${oldTender.title}`,
      description: oldTender.description,
      deadline: new Date(Date.now() + 7 * 86400000), // Default +7 days
      created_by: req.body.actioned_by || oldTender.created_by,
      notes: `განახლებული ტენდერიდან ${oldTender.tender_number}`,
      status: 'Draft',
      items: oldTender.items.map(it => ({
        item: it.item,
        qty_required: it.qty_required,
        notes: it.notes
      })),
      invited_suppliers: oldTender.invited_suppliers
    });

    await newTender.save();
    res.status(201).json({ tender_id: newTender._id, tender_number: newTender.tender_number });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Publish
router.post("/:id/publish", requireRoles(adminRoles), async (req, res) => {
  try {
    const tender = await Tender.findById(req.params.id);
    if (!tender) return res.status(404).json({ error: "Tender not found" });
    if (tender.status !== "Draft") return res.status(400).json({ error: "Only Draft tenders can be published" });
    tender.status = 'Published';
    await tender.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Close
router.post("/:id/close", requireRoles(adminRoles), async (req, res) => {
  try {
    const tender = await Tender.findById(req.params.id);
    if (!tender) return res.status(404).json({ error: "Tender not found" });
    if (tender.status !== "Published") return res.status(400).json({ error: "Only Published tenders can be closed" });
    tender.status = 'Closed';
    await tender.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Evaluate
router.post("/:id/evaluate", requireRoles(adminRoles), async (req, res) => {
  try {
    const tender = await Tender.findById(req.params.id);
    if (!tender) return res.status(404).json({ error: "Tender not found" });
    if (tender.status !== "Closed") return res.status(400).json({ error: "Only Closed tenders can be evaluated" });
    tender.status = 'Evaluation';
    await tender.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit / update bid
router.post("/:id/bids", requireRoles(supplierRoles), async (req, res) => {
  const { supplier_id, notes, lines } = req.body;
  try {
    const tender = await Tender.findById(req.params.id);
    if (!tender) return res.status(404).json({ error: "Tender not found" });
    if (!["Published", "Closed", "Evaluation"].includes(tender.status)) {
      return res.status(400).json({ error: "Bids can only be entered for Published/Closed/Evaluation tenders" });
    }
    if (!lines?.length) return res.status(400).json({ error: "At least one bid line required" });

    const totalAmount = lines.reduce((s, l) => s + (Number(l.unit_price) || 0) * (Number(l.qty_offered) || 0), 0);

    // Filter out existing bid from this supplier if any
    const otherBids = tender.bids.filter(b => String(b.supplier) !== String(supplier_id));
    
    const newBid = {
      supplier: supplier_id,
      submitted_at: new Date(),
      total_amount: totalAmount,
      notes: notes || null,
      lines: lines.map(l => ({
        tender_item_id: l.tender_item_id,
        unit_price: Number(l.unit_price),
        qty_offered: Number(l.qty_offered),
        notes: l.notes || null
      }))
    };

    tender.bids = [...otherBids, newBid];
    await tender.save();

    const savedBid = tender.bids.find(b => String(b.supplier) === String(supplier_id));
    res.status(201).json({ bid_id: savedBid._id, total_amount: totalAmount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Finance approval
router.post("/:id/finance-approve", requireRoles(financeRoles), async (req, res) => {
  const { approved_by } = req.body;
  try {
    const user = await User.findById(approved_by);
    if (!user || !["FinanceController", "GM"].includes(user.role)) {
      return res.status(403).json({ error: "Only Finance Controller or GM can approve" });
    }
    const tender = await Tender.findByIdAndUpdate(req.params.id, { finance_approved_by: approved_by }, { new: true });
    if (!tender) return res.status(404).json({ error: "Tender not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Award
router.post("/:id/award", requireRoles(adminRoles), async (req, res) => {
  const { awarded_by, winner_supplier_id } = req.body;
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const tender = await Tender.findById(req.params.id).populate('items.item').session(session);
    if (!tender) throw new Error("Tender not found");
    if (tender.status !== "Evaluation") throw new Error("Tender must be in Evaluation status");

    const awarder = await User.findById(awarded_by).session(session);
    if (!awarder || !["GM", "PurchasingOfficer"].includes(awarder.role)) {
      throw new Error("Only GM or Purchasing Officer can award");
    }

    const bid = tender.bids.find(b => String(b.supplier) === String(winner_supplier_id));
    if (!bid) throw new Error("No bid found for selected supplier");

    // Create PO from winning bid
    const poCount = await PurchaseOrder.countDocuments().session(session);
    const po_number = `PO-${new Date().getFullYear()}-${String(poCount + 1).padStart(3, "0")}`;

    const poLines = bid.lines.map(l => {
      // Find item_id from tender.items using tender_item_id
      const tenderItem = tender.items.find(ti => String(ti._id) === String(l.tender_item_id));
      return {
        item: tenderItem?.item._id,
        qty_ordered: l.qty_offered,
        unit_price: l.unit_price
      };
    });

    const po = new PurchaseOrder({
      po_number,
      supplier: winner_supplier_id,
      status: 'Approved',
      total_amount: bid.total_amount,
      created_by: awarded_by,
      notes: `Auto-generated from tender ${tender.tender_number}`,
      tender_id: tender._id,
      lines: poLines
    });

    await po.save({ session });

    tender.status = 'Awarded';
    tender.winner_supplier = winner_supplier_id;
    tender.awarded_by = awarded_by;
    tender.date_awarded = new Date();
    await tender.save({ session });

    await session.commitTransaction();
    res.json({ success: true, po_number, po_id: po._id });
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

// Cancel
router.post("/:id/cancel", requireRoles(adminRoles), async (req, res) => {
  try {
    const tender = await Tender.findById(req.params.id);
    if (!tender) return res.status(404).json({ error: "Tender not found" });
    if (["Awarded", "Cancelled"].includes(tender.status)) {
      return res.status(400).json({ error: "Cannot cancel an Awarded or already Cancelled tender" });
    }
    tender.status = 'Cancelled';
    await tender.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
