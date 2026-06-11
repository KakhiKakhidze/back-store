import { Router } from "express";
import { Supplier } from "../models/Supplier.js";
import { User } from "../models/User.js";

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
    const user = await User.findOne({ supplier: supplier._id, active: true });
    res.json({
      ...supplier.toObject(),
      username: user ? user.username : "",
      password: user ? user.password : "",
    });
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
    
    if (req.body.username && req.body.password) {
      const user = new User({
        username: req.body.username,
        password: req.body.password,
        full_name: req.body.contact_person || req.body.name,
        role: "Supplier",
        supplier: supplier._id,
        active: true,
      });
      await user.save();
    }
    
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

    if (req.body.username && req.body.password) {
      let user = await User.findOne({ supplier: req.params.id });
      if (user) {
        user.username = req.body.username;
        user.password = req.body.password;
        user.full_name = req.body.contact_person || req.body.name;
        user.active = true;
        await user.save();
      } else {
        user = new User({
          username: req.body.username,
          password: req.body.password,
          full_name: req.body.contact_person || req.body.name,
          role: "Supplier",
          supplier: req.params.id,
          active: true,
        });
        await user.save();
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", requireRoles(allowed), async (req, res) => {
  try {
    await Supplier.findByIdAndUpdate(req.params.id, { active: false });
    await User.findOneAndUpdate({ supplier: req.params.id }, { active: false });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
