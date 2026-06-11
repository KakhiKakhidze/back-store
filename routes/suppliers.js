import { Router } from "express";
import { Supplier } from "../models/Supplier.js";

import { requireRoles } from "../middleware/roleMiddleware.js";

const router = Router();
const allowed = ['PurchasingOfficer', 'GM'];

router.get("/", requireRoles(allowed), async (req, res) => {
  try {
    const suppliers = await Supplier.find({ active: true }).sort('name');
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", requireRoles(allowed), async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ error: "Supplier not found" });
    res.json(supplier);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", requireRoles(allowed), async (req, res) => {
  try {
    const supplier = new Supplier({
      ...req.body,
      preferred: req.body.preferred ? true : false,
    });
    await supplier.save();
    res.status(201).json({ id: supplier._id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", requireRoles(allowed), async (req, res) => {
  try {
    const data = {
      ...req.body,
      preferred: req.body.preferred ? true : false,
    };
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!supplier) return res.status(404).json({ error: "Supplier not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", requireRoles(allowed), async (req, res) => {
  try {
    await Supplier.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
