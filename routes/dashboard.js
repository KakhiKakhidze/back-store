import { Router } from "express";
import { Item } from "../models/Item.js";
import { StoreRequisition } from "../models/StoreRequisition.js";
import { PurchaseRequisition } from "../models/PurchaseRequisition.js";
import { PurchaseOrder } from "../models/PurchaseOrder.js";
import { StockMovement } from "../models/StockMovement.js";
import { GoodsReceivedNote } from "../models/GoodsReceivedNote.js";
import { Tender } from "../models/Tender.js";
import { Category } from "../models/Category.js";

import { requireRoles } from "../middleware/roleMiddleware.js";

const router = Router();
const allowed = ['Storekeeper', 'PurchasingOfficer', 'FinanceController', 'DeptHead'];

router.get("/", requireRoles(allowed), async (req, res) => {
  try {
    const totalItems = await Item.countDocuments({ active: true });
    
    const items = await Item.find({ active: true });
    const totalValue = items.reduce((sum, i) => sum + (i.current_qty * i.unit_cost), 0);
    
    const lowStockItems = await Item.find({
      active: true,
      $expr: { $lte: ["$current_qty", "$reorder_point"] }
    }).populate('category');

    const pendingSRF = await StoreRequisition.countDocuments({ status: 'Pending' });
    const pendingPR = await PurchaseRequisition.countDocuments({ status: 'Pending' });
    const openPO = await PurchaseOrder.countDocuments({ status: { $in: ['Draft', 'Approved', 'PartiallyReceived'] } });

    const recentMovements = await StockMovement.find()
      .populate('item', 'code name')
      .populate('performed_by', 'full_name')
      .sort({ createdAt: -1 })
      .limit(10);

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const today = new Date();

    const grns = await GoodsReceivedNote.find({
      'lines.expiry_date': { $gte: today, $lte: thirtyDaysFromNow }
    }).populate('lines.item', 'code name');

    const expiringItems = [];
    grns.forEach(g => {
      g.lines.forEach(l => {
        if (l.expiry_date >= today && l.expiry_date <= thirtyDaysFromNow) {
          expiringItems.push({
            ...l.toObject(),
            item_code: l.item?.code,
            item_name: l.item?.name,
            grn_number: g.grn_number
          });
        }
      });
    });

    const categories = await Category.find();
    const categoryMap = {};
    categories.forEach(c => {
      categoryMap[String(c._id)] = { name: c.name, value: 0, item_count: 0 };
    });

    items.forEach(i => {
      const catId = i.category ? String(i.category._id || i.category) : "";
      if (categoryMap[catId]) {
        categoryMap[catId].value += (i.current_qty * i.unit_cost);
        categoryMap[catId].item_count += 1;
      }
    });
    const categoryValues = Object.values(categoryMap);
    categoryValues.sort((a, b) => b.value - a.value);

    // Movement trends (last 7 days) - Single query optimized
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentMovements7Days = await StockMovement.find({
      createdAt: { $gte: sevenDaysAgo }
    });

    const trends = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toLocaleDateString("en-US", { weekday: "short" });

      const startOfDay = new Date(d);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(d);
      endOfDay.setHours(23, 59, 59, 999);

      const dayMovements = recentMovements7Days.filter(m =>
        m.createdAt >= startOfDay && m.createdAt <= endOfDay
      );

      const receiptsSum = dayMovements
        .filter(m => m.movement_type === 'Receipt')
        .reduce((sum, m) => sum + m.qty, 0);

      const issuesSum = dayMovements
        .filter(m => m.movement_type === 'Issue')
        .reduce((sum, m) => sum + Math.abs(m.qty), 0);

      trends.push({
        day: dStr,
        receipts: receiptsSum,
        issues: issuesSum
      });
    }

    const healthyItems = totalItems > 0 ? totalItems - lowStockItems.length : 0;
    const stockHealthPct = totalItems > 0 ? Math.round((healthyItems / totalItems) * 100) : 100;

    const activeTenders = await Tender.countDocuments({ status: { $in: ['Draft', 'Published', 'Closed', 'Evaluation'] } });
    const pendingEvaluation = await Tender.countDocuments({ status: 'Evaluation' });
    const publishedTenders = await Tender.countDocuments({ status: 'Published' });
    const recentTenders = await Tender.find()
      .populate('winner_supplier', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      totalItems,
      totalValue,
      lowStockCount: lowStockItems.length,
      lowStockItems: lowStockItems.map(i => ({ ...i.toObject(), id: i._id, category_name: i.category?.name })),
      pendingSRF,
      pendingPR,
      openPO,
      recentMovements: recentMovements.map(m => ({
        ...m.toObject(),
        id: m._id,
        item_code: m.item?.code,
        item_name: m.item?.name,
        performer_name: m.performed_by?.full_name,
        date: m.createdAt
      })),
      expiringItems,
      categoryValues,
      movementTrends: trends,
      stockHealthPct,
      tenderStats: { activeTenders, pendingEvaluation, publishedTenders },
      recentTenders: recentTenders.map(t => ({ ...t.toObject(), id: t._id, winner_name: t.winner_supplier?.name, date_created: t.createdAt })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
