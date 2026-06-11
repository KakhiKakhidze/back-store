import { Router } from "express";
import { Item } from "../models/Item.js";
import { Category } from "../models/Category.js";

import { requireRoles } from "../middleware/roleMiddleware.js";

const router = Router();
const allowed = ['Storekeeper', 'PurchasingOfficer'];

router.get("/categories", requireRoles(allowed), async (req, res) => {
  try {
    const cats = await Category.find().sort('name');
    res.json(cats.map(c => ({ id: c._id, name: c.name })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", requireRoles(allowed), async (req, res) => {
  const { category, search, low_stock } = req.query;
  try {
    let query = { active: true };
    
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }
    if (low_stock === "1") {
      query.$where = "this.current_qty <= this.reorder_point";
    }
    
    const items = await Item.find(query).populate('category').sort('code');
    res.json(items.map(i => {
      const obj = i.toObject();
      if (obj.category) {
        obj.category_name = obj.category.name;
      }
      return obj;
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", requireRoles(allowed), async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate('category');
    if (!item) return res.status(404).json({ error: "Item not found" });
    const obj = item.toObject();
    if (obj.category) obj.category_name = obj.category.name;
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", requireRoles(allowed), async (req, res) => {
  try {
    const { category_id, ...rest } = req.body;
    const item = new Item({
      ...rest,
      category: category_id,
      is_perishable: req.body.is_perishable ? true : false,
      is_controlled: req.body.is_controlled ? true : false,
    });
    await item.save();
    res.status(201).json({ id: item._id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", requireRoles(allowed), async (req, res) => {
  try {
    const { category_id, ...rest } = req.body;
    const data = {
      ...rest,
      category: category_id,
      is_perishable: req.body.is_perishable ? true : false,
      is_controlled: req.body.is_controlled ? true : false,
    };
    const item = await Item.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", requireRoles(allowed), async (req, res) => {
  try {
    await Item.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
