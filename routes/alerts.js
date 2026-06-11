import { Router } from "express";
import { Item } from "../models/Item.js";

import { requireRoles } from "../middleware/roleMiddleware.js";

const router = Router();
const allowed = ['Storekeeper', 'PurchasingOfficer'];
const LOW_STOCK_THRESHOLD = 50;

router.get("/", requireRoles(allowed), async (req, res) => {
  try {
    const items = await Item.find({ 
      active: true, 
      current_qty: { $lt: LOW_STOCK_THRESHOLD } 
    })
    .populate('category')
    .sort({ current_qty: 1 });
    
    res.json({
      threshold: LOW_STOCK_THRESHOLD,
      count: items.length,
      items: items.map(i => {
        const obj = i.toObject();
        obj.category_name = i.category?.name;
        obj.id = i._id;
        return obj;
      })
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
