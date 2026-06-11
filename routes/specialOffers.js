import { Router } from "express";
import mongoose from "mongoose";
import { SpecialOffer } from "../models/SpecialOffer.js";
import { SupplierProduct } from "../models/SupplierProduct.js";
import { PurchaseOrder } from "../models/PurchaseOrder.js";
import { Item } from "../models/Item.js";
import { Category } from "../models/Category.js";
import { requireRoles } from "../middleware/roleMiddleware.js";

const router = Router();
const adminRoles = ['PurchasingOfficer', 'GM'];
const supplierRoles = ['Supplier'];

// Auto-expire offers whose validity has passed
async function autoExpireOffers() {
  try {
    await SpecialOffer.updateMany(
      { status: 'Pending', valid_until: { $lt: new Date() } },
      { $set: { status: 'Expired' } }
    );
  } catch (err) {
    console.error('autoExpireOffers failed:', err.message);
  }
}

const formatOffer = (o) => {
  const obj = o.toObject ? o.toObject() : o;
  const sp = obj.supplier_product || {};
  return {
    id: String(obj._id),
    offer_number: obj.offer_number,
    supplier_id: obj.supplier?._id ? String(obj.supplier._id) : String(obj.supplier),
    supplier_name: obj.supplier?.name,
    supplier_phone: obj.supplier?.phone,
    supplier_email: obj.supplier?.email,
    supplier_contact: obj.supplier?.contact_person,
    supplier_product_id: sp._id ? String(sp._id) : String(obj.supplier_product),
    item_code: sp.code,
    item_name: sp.name,
    unit_of_measure: sp.unit_of_measure,
    item_description: sp.description,
    item_category: sp.category,
    linked_item_id: sp.linked_item ? String(sp.linked_item) : null,
    unit_price: obj.unit_price,
    qty_offered: obj.qty_offered,
    valid_until: obj.valid_until,
    notes: obj.notes,
    status: obj.status,
    reviewed_by: obj.reviewed_by?._id ? String(obj.reviewed_by._id) : obj.reviewed_by,
    reviewer_name: obj.reviewed_by?.full_name,
    date_reviewed: obj.date_reviewed,
    rejection_reason: obj.rejection_reason,
    po_id: obj.po_id ? String(obj.po_id) : null,
    total_amount: Number(obj.unit_price || 0) * Number(obj.qty_offered || 0),
    created_at: obj.createdAt,
  };
};

// Admin: list all offers (optionally filtered by status)
router.get("/", requireRoles(adminRoles), async (req, res) => {
  try {
    await autoExpireOffers();
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const offers = await SpecialOffer.find(filter)
      .populate('supplier', 'name phone email contact_person')
      .populate('supplier_product')
      .populate('reviewed_by', 'full_name')
      .sort({ createdAt: -1 });
    res.json(offers.map(formatOffer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Supplier: list own offers
router.get("/mine", requireRoles(supplierRoles), async (req, res) => {
  try {
    await autoExpireOffers();
    const { supplier_id } = req.query;
    if (!supplier_id) return res.status(400).json({ error: "supplier_id required" });
    const offers = await SpecialOffer.find({ supplier: supplier_id })
      .populate('supplier', 'name phone email contact_person')
      .populate('supplier_product')
      .populate('reviewed_by', 'full_name')
      .sort({ createdAt: -1 });
    res.json(offers.map(formatOffer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Supplier: create new offer (must reference one of supplier's own products)
router.post("/", requireRoles(supplierRoles), async (req, res) => {
  const { supplier_id, supplier_product_id, unit_price, qty_offered, valid_until, notes } = req.body;
  try {
    if (!supplier_id || !supplier_product_id || !unit_price || !qty_offered || !valid_until) {
      return res.status(400).json({ error: "supplier_id, supplier_product_id, unit_price, qty_offered, valid_until are required" });
    }
    if (new Date(valid_until) <= new Date()) {
      return res.status(400).json({ error: "valid_until must be in the future" });
    }
    const product = await SupplierProduct.findById(supplier_product_id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    if (String(product.supplier) !== String(supplier_id)) {
      return res.status(403).json({ error: "You can only offer your own products" });
    }
    if (!product.active) {
      return res.status(400).json({ error: "Product is inactive" });
    }

    const count = await SpecialOffer.countDocuments();
    const offer_number = `OFR-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;

    const offer = new SpecialOffer({
      offer_number,
      supplier: supplier_id,
      supplier_product: supplier_product_id,
      unit_price: Number(unit_price),
      qty_offered: Number(qty_offered),
      valid_until,
      notes,
      status: 'Pending',
    });
    await offer.save();
    res.status(201).json({ id: offer._id, offer_number });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Supplier: update own pending offer
router.put("/:id", requireRoles(supplierRoles), async (req, res) => {
  const { supplier_id, unit_price, qty_offered, valid_until, notes } = req.body;
  try {
    const offer = await SpecialOffer.findById(req.params.id);
    if (!offer) return res.status(404).json({ error: "Offer not found" });
    if (String(offer.supplier) !== String(supplier_id)) {
      return res.status(403).json({ error: "Cannot edit another supplier's offer" });
    }
    if (offer.status !== 'Pending') {
      return res.status(400).json({ error: `Cannot edit ${offer.status} offer` });
    }
    if (unit_price !== undefined) offer.unit_price = Number(unit_price);
    if (qty_offered !== undefined) offer.qty_offered = Number(qty_offered);
    if (valid_until !== undefined) offer.valid_until = valid_until;
    if (notes !== undefined) offer.notes = notes;
    await offer.save();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Supplier: withdraw own pending offer
router.post("/:id/withdraw", requireRoles(supplierRoles), async (req, res) => {
  const { supplier_id } = req.body;
  try {
    const offer = await SpecialOffer.findById(req.params.id);
    if (!offer) return res.status(404).json({ error: "Offer not found" });
    if (String(offer.supplier) !== String(supplier_id)) {
      return res.status(403).json({ error: "Cannot withdraw another supplier's offer" });
    }
    if (offer.status !== 'Pending') {
      return res.status(400).json({ error: `Cannot withdraw ${offer.status} offer` });
    }
    offer.status = 'Withdrawn';
    await offer.save();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Helper: ensure an inventory Item exists for a SupplierProduct.
// If supplier_product.linked_item is set, return that. Otherwise create a new Item.
async function ensureInventoryItem(supplierProduct, session) {
  if (supplierProduct.linked_item) {
    const existing = await Item.findById(supplierProduct.linked_item).session(session);
    if (existing) return existing;
  }

  // Auto-create. Need a category (Item.category is required).
  let category = await Category.findOne(
    supplierProduct.category ? { name: supplierProduct.category } : {}
  ).session(session);
  if (!category) {
    category = await Category.findOne().session(session);
    if (!category) {
      const created = await Category.create([{ name: 'Uncategorized' }], { session });
      category = created[0];
    }
  }

  // Generate a unique inventory code prefixed SP-
  const baseCode = `SP-${supplierProduct.code}`.toUpperCase().replace(/\s+/g, '-');
  let code = baseCode;
  let suffix = 1;
  while (await Item.findOne({ code }).session(session)) {
    suffix += 1;
    code = `${baseCode}-${suffix}`;
  }

  const newItem = new Item({
    code,
    name: supplierProduct.name,
    category: category._id,
    unit_of_measure: supplierProduct.unit_of_measure,
    unit_cost: supplierProduct.default_unit_price || 0,
    current_qty: 0,
  });
  await newItem.save({ session });

  supplierProduct.linked_item = newItem._id;
  await supplierProduct.save({ session });

  return newItem;
}

// Admin: accept offer → creates a PO (and inventory Item if needed)
router.post("/:id/accept", requireRoles(adminRoles), async (req, res) => {
  const { reviewed_by } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const offer = await SpecialOffer.findById(req.params.id)
      .populate('supplier_product')
      .session(session);
    if (!offer) throw new Error("Offer not found");
    if (offer.status !== 'Pending') throw new Error(`Cannot accept ${offer.status} offer`);
    if (new Date(offer.valid_until) < new Date()) throw new Error("Offer has expired");
    if (!offer.supplier_product) throw new Error("Offer's product is missing");

    // Re-fetch supplier_product so .save inside helper persists changes
    const supplierProduct = await SupplierProduct.findById(offer.supplier_product._id).session(session);
    const inventoryItem = await ensureInventoryItem(supplierProduct, session);

    const poCount = await PurchaseOrder.countDocuments().session(session);
    const po_number = `PO-${new Date().getFullYear()}-${String(poCount + 1).padStart(3, "0")}`;

    const total = Number(offer.unit_price) * Number(offer.qty_offered);

    const po = new PurchaseOrder({
      po_number,
      supplier: offer.supplier,
      status: 'Approved',
      total_amount: total,
      created_by: reviewed_by,
      notes: `Auto-generated from special offer ${offer.offer_number}`,
      lines: [{
        item: inventoryItem._id,
        qty_ordered: offer.qty_offered,
        unit_price: offer.unit_price,
      }],
    });
    await po.save({ session });

    offer.status = 'Accepted';
    offer.reviewed_by = reviewed_by;
    offer.date_reviewed = new Date();
    offer.po_id = po._id;
    await offer.save({ session });

    await session.commitTransaction();
    res.json({ success: true, po_number, po_id: po._id, item_code: inventoryItem.code });
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

// Admin: reject offer
router.post("/:id/reject", requireRoles(adminRoles), async (req, res) => {
  const { reviewed_by, rejection_reason } = req.body;
  try {
    const offer = await SpecialOffer.findById(req.params.id);
    if (!offer) return res.status(404).json({ error: "Offer not found" });
    if (offer.status !== 'Pending') {
      return res.status(400).json({ error: `Cannot reject ${offer.status} offer` });
    }
    offer.status = 'Rejected';
    offer.reviewed_by = reviewed_by;
    offer.date_reviewed = new Date();
    offer.rejection_reason = rejection_reason || null;
    await offer.save();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
