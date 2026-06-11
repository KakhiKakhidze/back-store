import { Router } from "express";
import { SupplierProduct } from "../models/SupplierProduct.js";
import { requireRoles } from "../middleware/roleMiddleware.js";

const router = Router();
const adminRoles = ['PurchasingOfficer', 'GM'];
const supplierRoles = ['Supplier'];

const formatProduct = (p) => {
  const obj = p.toObject ? p.toObject() : p;
  return {
    id: String(obj._id),
    supplier_id: obj.supplier?._id ? String(obj.supplier._id) : String(obj.supplier),
    supplier_name: obj.supplier?.name,
    code: obj.code,
    name: obj.name,
    unit_of_measure: obj.unit_of_measure,
    default_unit_price: obj.default_unit_price,
    description: obj.description,
    category: obj.category,
    linked_item_id: obj.linked_item ? String(obj.linked_item) : null,
    active: obj.active,
    created_at: obj.createdAt,
    updated_at: obj.updatedAt,
  };
};

// Supplier: list own products
router.get("/mine", requireRoles(supplierRoles), async (req, res) => {
  try {
    const { supplier_id } = req.query;
    if (!supplier_id) return res.status(400).json({ error: "supplier_id required" });
    const products = await SupplierProduct.find({ supplier: supplier_id }).sort({ name: 1 });
    res.json(products.map(formatProduct));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: list all suppliers' products (read-only)
router.get("/", requireRoles(adminRoles), async (req, res) => {
  try {
    const filter = {};
    if (req.query.supplier_id) filter.supplier = req.query.supplier_id;
    const products = await SupplierProduct.find(filter)
      .populate('supplier', 'name')
      .sort({ name: 1 });
    res.json(products.map(formatProduct));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Supplier: create product
router.post("/", requireRoles(supplierRoles), async (req, res) => {
  const { supplier_id, code, name, unit_of_measure, default_unit_price, description, category } = req.body;
  try {
    if (!supplier_id || !code || !name || !unit_of_measure) {
      return res.status(400).json({ error: "supplier_id, code, name, unit_of_measure are required" });
    }
    const product = new SupplierProduct({
      supplier: supplier_id,
      code: code.trim(),
      name: name.trim(),
      unit_of_measure: unit_of_measure.trim(),
      default_unit_price: Number(default_unit_price || 0),
      description,
      category,
      active: true,
    });
    await product.save();
    res.status(201).json({ id: product._id });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "ამ კოდით პროდუქტი უკვე გაქვთ კატალოგში" });
    }
    res.status(400).json({ error: err.message });
  }
});

// Supplier: update own product
router.put("/:id", requireRoles(supplierRoles), async (req, res) => {
  const { supplier_id, code, name, unit_of_measure, default_unit_price, description, category, active } = req.body;
  try {
    const product = await SupplierProduct.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    if (String(product.supplier) !== String(supplier_id)) {
      return res.status(403).json({ error: "Cannot edit another supplier's product" });
    }
    if (code !== undefined) product.code = code.trim();
    if (name !== undefined) product.name = name.trim();
    if (unit_of_measure !== undefined) product.unit_of_measure = unit_of_measure.trim();
    if (default_unit_price !== undefined) product.default_unit_price = Number(default_unit_price);
    if (description !== undefined) product.description = description;
    if (category !== undefined) product.category = category;
    if (active !== undefined) product.active = Boolean(active);
    await product.save();
    res.json({ success: true });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "ამ კოდით პროდუქტი უკვე გაქვთ კატალოგში" });
    }
    res.status(400).json({ error: err.message });
  }
});

// Supplier: soft-delete own product
router.delete("/:id", requireRoles(supplierRoles), async (req, res) => {
  const { supplier_id } = req.query;
  try {
    const product = await SupplierProduct.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    if (String(product.supplier) !== String(supplier_id)) {
      return res.status(403).json({ error: "Cannot delete another supplier's product" });
    }
    product.active = false;
    await product.save();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
