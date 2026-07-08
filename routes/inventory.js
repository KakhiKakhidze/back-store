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


router.post("/import", requireRoles(allowed), async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "Invalid items format. Expected an array." });
  }

  const binPrefixes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  function getRandomBin() {
    const prefix = binPrefixes[Math.floor(Math.random() * binPrefixes.length)];
    const num = Math.floor(Math.random() * 20) + 1;
    return `${prefix}-${String(num).padStart(2, '0')}`;
  }

  try {
    const existingCats = await Category.find();
    const categoryMap = new Map();
    existingCats.forEach(c => categoryMap.set(c.name.trim().toLowerCase(), c._id));

    const existingItems = await Item.find();
    const existingItemCodes = new Set(existingItems.map(i => i.code.trim().toLowerCase()));

    const uniqueCategories = new Set();
    const itemsToProcess = [];
    const seenCodes = new Set();

    for (const itemData of items) {
      const code = itemData.code !== undefined && itemData.code !== null ? String(itemData.code).trim() : '';
      const name = itemData.name !== undefined && itemData.name !== null ? String(itemData.name).trim() : '';
      const categoryName = itemData.category !== undefined && itemData.category !== null ? String(itemData.category).trim() : '';
      const unitOfMeasure = itemData.unit_of_measure !== undefined && itemData.unit_of_measure !== null ? String(itemData.unit_of_measure).trim() : '';

      if (!code || !name || !categoryName) continue;

      const lowerCode = code.toLowerCase();
      if (seenCodes.has(lowerCode)) continue; // ignore duplicates in the payload
      seenCodes.add(lowerCode);

      uniqueCategories.add(categoryName);
      itemsToProcess.push({ code, name, categoryName, unitOfMeasure });
    }

    let newCatsCount = 0;
    for (const catName of uniqueCategories) {
      const key = catName.trim().toLowerCase();
      if (!categoryMap.has(key)) {
        const newCat = new Category({ name: catName });
        await newCat.save();
        categoryMap.set(key, newCat._id);
        newCatsCount++;
      }
    }

    const bulkOps = [];
    let insertedCount = 0;
    let updatedCount = 0;

    for (const itemData of itemsToProcess) {
      const catId = categoryMap.get(itemData.categoryName.trim().toLowerCase());
      const lowerCode = itemData.code.toLowerCase();

      const updateData = {
        name: itemData.name,
        category: catId,
        unit_of_measure: itemData.unitOfMeasure || 'pcs',
        location_bin: getRandomBin(),
        current_qty: 0,
        min_stock_level: 0,
        reorder_point: 0,
        reorder_qty: 0,
        unit_cost: 0,
        is_perishable: false,
        is_controlled: false,
        active: true
      };

      if (existingItemCodes.has(lowerCode)) {
        bulkOps.push({
          updateOne: {
            filter: { code: itemData.code },
            update: { $set: updateData }
          }
        });
        updatedCount++;
      } else {
        bulkOps.push({
          insertOne: {
            document: {
              code: itemData.code,
              ...updateData
            }
          }
        });
        insertedCount++;
      }
    }

    if (bulkOps.length > 0) {
      await Item.bulkWrite(bulkOps);
    }

    res.json({
      success: true,
      insertedCount,
      updatedCount,
      categoriesCreated: newCatsCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
