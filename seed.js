import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './models/User.js';
import { Department } from './models/Department.js';
import { Category } from './models/Category.js';
import { Supplier } from './models/Supplier.js';
import { Item } from './models/Item.js';
import { PurchaseOrder } from './models/PurchaseOrder.js';
import { GoodsReceivedNote } from './models/GoodsReceivedNote.js';
import { StockMovement } from './models/StockMovement.js';
import { StoreRequisition } from './models/StoreRequisition.js';
import { Tender } from './models/Tender.js';

dotenv.config();

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for seeding...');

    console.log('Clearing existing database...');
    const collections = ['users', 'departments', 'categories', 'suppliers', 'items', 'purchaseorders', 'goodsreceivednotes', 'stockmovements', 'storerequisitions', 'tenders', 'specialoffers', 'supplierproducts'];
    for (const c of collections) {
      try { await mongoose.connection.collection(c).deleteMany({}); } catch(e) {}
    }

    console.log('Seeding database with BIG DATA...');

    // 1. Departments
    const depts = [
      { name: "Food & Beverage", code: "FNB" },
      { name: "Housekeeping", code: "HK" },
      { name: "Engineering", code: "ENG" },
      { name: "Front Office", code: "FO" },
      { name: "Kitchen", code: "KIT" },
      { name: "Bar", code: "BAR" },
      { name: "Administration", code: "ADMIN" },
      { name: "IT Department", code: "IT" },
      { name: "Sales & Marketing", code: "SALES" },
      { name: "Security", code: "SEC" },
    ];
    const createdDepts = await Department.insertMany(depts);

    // 2. Categories
    const catNames = [
      "Dry Food & Staples", "Fresh Produce", "Dairy & Eggs", "Meat & Poultry", "Seafood",
      "Beverages (Non-Alc)", "Beverages (Alcoholic)", "Cleaning Chemicals", "Cleaning Tools",
      "Guest Room Amenities", "Linen & Textiles", "Paper Products", "Maintenance & Spares",
      "Office Stationery", "IT Hardware", "Kitchen Smallware"
    ];
    const createdCats = await Category.insertMany(catNames.map(name => ({ name })));

    // 3. Suppliers
    const suppliers = [
      { name: "Global Food Systems", contact_person: "Alex Hunter", phone: "+254711000101", email: "orders@globalfood.com", address: "Highway Blvd, Block A", lead_time_days: 2, preferred: true },
      { name: "Green Valley Farms", contact_person: "Sarah Green", phone: "+254711000102", email: "sarah@greenvalley.com", address: "Farm Rd, Naivasha", lead_time_days: 1, preferred: true },
      { name: "Sparkle Clean Co", contact_person: "Mike Ross", phone: "+254711000103", email: "info@sparkle.com", address: "Mombasa Rd, Nairobi", lead_time_days: 3, preferred: false },
      { name: "Office Depot Kenya", contact_person: "Jane Doe", phone: "+254711000104", email: "sales@officedepot.ke", address: "Industrial Area", lead_time_days: 2, preferred: true },
      { name: "Elite Spirits & Wines", contact_person: "Robert Baratheon", phone: "+254711000105", email: "robert@elitespirits.com", address: "Westlands", lead_time_days: 4, preferred: true },
      { name: "Hardware & Spares Ltd", contact_person: "Tony Stark", phone: "+254711000106", email: "spares@ironman.com", address: "Ngong Rd", lead_time_days: 5, preferred: false },
      { name: "Tech Solutions Inc", contact_person: "Bill Gates", phone: "+254711000107", email: "support@techsolutions.com", address: "Upper Hill", lead_time_days: 7, preferred: false },
    ];
    const createdSuppliers = await Supplier.insertMany(suppliers);

    // 4. Items (30+ products)
    const itemsData = [
      // Dry Food
      ["FD-001", "Basmati Rice (25kg)", 0, "bag", "A-01", 50, 10, 15, 20, 45.00, false, false],
      ["FD-002", "Spaghetti (500g)", 0, "pcs", "A-02", 200, 40, 50, 100, 0.85, false, false],
      ["FD-003", "Cooking Oil (10L)", 0, "tin", "A-03", 30, 5, 8, 15, 18.50, false, false],
      ["FD-004", "Sugar White (50kg)", 0, "bag", "A-04", 15, 4, 6, 10, 55.00, false, false],
      ["FD-005", "Table Salt (1kg)", 0, "pcs", "A-05", 48, 12, 12, 24, 0.40, false, false],
      // Fresh Produce
      ["FP-001", "Onions Red (kg)", 1, "kg", "B-01", 120, 20, 30, 50, 1.10, true, false],
      ["FP-002", "Potatoes Irish (kg)", 1, "kg", "B-02", 250, 50, 75, 100, 0.65, true, false],
      ["FP-003", "Tomatoes (kg)", 1, "kg", "B-03", 85, 15, 25, 40, 1.40, true, false],
      // Dairy
      ["DY-001", "Milk Fresh (1L)", 2, "ltr", "C-01", 45, 12, 18, 50, 1.25, true, false],
      ["DY-002", "Butter Unsalted (250g)", 2, "pcs", "C-02", 60, 12, 12, 24, 2.80, true, false],
      ["DY-003", "Cheddar Cheese (kg)", 2, "kg", "C-03", 12, 3, 5, 8, 14.50, true, false],
      // Cleaning
      ["CL-001", "Dishwashing Liquid (5L)", 7, "btl", "CH-01", 20, 4, 5, 10, 12.00, false, false],
      ["CL-002", "Bleach (5L)", 7, "btl", "CH-02", 15, 3, 4, 8, 6.50, false, false],
      ["CL-003", "Floor Cleaner (5L)", 7, "btl", "CH-03", 10, 2, 3, 5, 15.00, false, false],
      // Beverages
      ["BV-001", "Coca Cola (300ml)", 5, "crate", "D-01", 25, 5, 8, 12, 14.00, false, false],
      ["BV-002", "Orange Juice (1L)", 5, "pcs", "D-02", 72, 12, 24, 48, 2.20, false, false],
      ["BV-003", "Coffee Beans (kg)", 5, "kg", "D-03", 15, 3, 5, 10, 22.00, false, false],
      // Spirits
      ["AL-001", "Whisky (Black Label 750ml)", 6, "btl", "E-01", 12, 3, 4, 6, 35.00, false, true],
      ["AL-002", "Gin (Beefeater 750ml)", 6, "btl", "E-02", 10, 2, 3, 4, 28.00, false, true],
      ["AL-003", "Wine Red (Caberenet 750ml)", 6, "btl", "E-03", 36, 6, 12, 24, 15.00, false, true],
      // Paper
      ["PA-001", "Toilet Tissue (Pack 40)", 11, "pack", "F-01", 40, 10, 15, 20, 19.50, false, false],
      ["PA-002", "Paper Napkins (Pack 100)", 11, "pack", "F-02", 100, 20, 30, 50, 3.20, false, false],
      // Maintenance
      ["MT-001", "LED Bulb 9W", 12, "pcs", "G-01", 150, 30, 40, 50, 2.50, false, false],
      ["MT-002", "AA Batteries (Pack 4)", 12, "pack", "G-02", 80, 16, 20, 32, 4.00, false, false],
      ["MT-003", "WD-40 Spray (400ml)", 12, "pcs", "G-03", 25, 5, 5, 10, 8.50, false, false],
      // IT
      ["IT-001", "A4 Printing Paper (Ream)", 13, "ream", "H-01", 60, 10, 15, 30, 5.50, false, false],
      ["IT-002", "Printer Toner (HP 85A)", 13, "pcs", "H-02", 8, 2, 2, 4, 65.00, false, false],
    ];

    const items = itemsData.map(id => ({
      code: id[0],
      name: id[1],
      category: createdCats[id[2]]._id,
      unit_of_measure: id[3],
      location_bin: id[4],
      current_qty: id[5],
      min_stock_level: id[6],
      reorder_point: id[7],
      reorder_qty: id[8],
      unit_cost: id[9],
      is_perishable: id[10],
      is_controlled: id[11]
    }));
    const createdItems = await Item.insertMany(items);

    // 5. Users — only admin and supplier accounts
    const users = [
      { username: "admin", password: "admin123", full_name: "John Doe", role: "GM" },
      { username: "metro", password: "pass123", full_name: "Global Food Rep", role: "Supplier", supplier: createdSuppliers[0]._id },
      { username: "greenf", password: "pass123", full_name: "Green Valley Rep", role: "Supplier", supplier: createdSuppliers[1]._id },
    ];
    const createdUsers = await User.insertMany(users);
    // Indexes after re-seed: 0 = admin (GM), 1 = metro (Supplier), 2 = greenf (Supplier)
    const adminUser = createdUsers[0];

    // 6. Tenders (10+ different states) — all created/awarded by admin
    const tenders = [
      {
        tender_number: 'TND-2026-001', title: 'Annual Dry Goods Supply', status: 'Awarded',
        deadline: new Date('2026-03-01'), created_by: adminUser._id,
        items: [{ item: createdItems[0]._id, qty_required: 1200 }, { item: createdItems[1]._id, qty_required: 5000 }],
        winner_supplier: createdSuppliers[0]._id, awarded_by: adminUser._id, date_awarded: new Date('2026-03-10')
      },
      {
        tender_number: 'TND-2026-002', title: 'Fresh Vegetables Q2', status: 'Published',
        deadline: new Date(Date.now() + 10 * 86400000), created_by: adminUser._id,
        items: [{ item: createdItems[5]._id, qty_required: 500 }, { item: createdItems[6]._id, qty_required: 1000 }],
        invited_suppliers: [createdSuppliers[1]._id]
      },
      {
        tender_number: 'TND-2026-003', title: 'Beverage Distribution Contract', status: 'Evaluation',
        deadline: new Date(Date.now() - 2 * 86400000), created_by: adminUser._id,
        items: [{ item: createdItems[14]._id, qty_required: 200 }, { item: createdItems[15]._id, qty_required: 1000 }],
        bids: [
          { supplier: createdSuppliers[4]._id, total_amount: 15000, lines: [{ tender_item_id: "000000000000000000000000", unit_price: 15, qty_offered: 200 }] }
        ]
      },
      {
        tender_number: 'TND-2026-004', title: 'Kitchen Equipment Replacement', status: 'Draft',
        deadline: new Date(Date.now() + 30 * 86400000), created_by: adminUser._id,
        items: [{ item: createdItems[22]._id, qty_required: 100 }]
      },
      {
        tender_number: 'TND-2026-005', title: 'Chemicals & Detergents 2026', status: 'Published',
        deadline: new Date(Date.now() + 5 * 86400000), created_by: adminUser._id,
        items: [{ item: createdItems[11]._id, qty_required: 100 }, { item: createdItems[12]._id, qty_required: 50 }]
      },
      {
        tender_number: 'TND-2026-006', title: 'Linen Upgrade Project', status: 'Cancelled',
        deadline: new Date('2026-01-15'), created_by: adminUser._id,
        notes: 'Project budget redirected to IT infrastructure.'
      },
      {
        tender_number: 'TND-2026-007', title: 'Office Tech Refresh', status: 'Closed',
        deadline: new Date(Date.now() - 1 * 86400000), created_by: adminUser._id,
        items: [{ item: createdItems[26]._id, qty_required: 10 }]
      },
    ];
    await Tender.insertMany(tenders);

    // 7. Store Requisitions (Simulate activity) — all by admin
    const storeReqs = [
      {
        srf_number: 'SRF-001', department: createdDepts[0]._id, requested_by: adminUser._id,
        status: 'Issued', date_issued: new Date(), items_count: 3,
        lines: [{ item: createdItems[0]._id, qty_requested: 5, qty_issued: 5 }, { item: createdItems[8]._id, qty_requested: 10, qty_issued: 10 }]
      },
      {
        srf_number: 'SRF-002', department: createdDepts[2]._id, requested_by: adminUser._id,
        status: 'Pending', items_count: 1,
        lines: [{ item: createdItems[22]._id, qty_requested: 20 }]
      }
    ];
    await StoreRequisition.insertMany(storeReqs);

    // 8. Purchase Orders — all created by admin
    const pos = [
      {
        po_number: 'PO-2026-001', supplier: createdSuppliers[0]._id, status: 'Received',
        total_amount: 2500, created_by: adminUser._id,
        lines: [{ item: createdItems[0]._id, qty_ordered: 50, unit_price: 45, qty_received: 50 }]
      },
      {
        po_number: 'PO-2026-002', supplier: createdSuppliers[4]._id, status: 'Approved',
        total_amount: 1200, created_by: adminUser._id,
        lines: [{ item: createdItems[17]._id, qty_ordered: 20, unit_price: 35 }]
      }
    ];
    await PurchaseOrder.insertMany(pos);

    console.log('Seed BIG DATA complete.');
    console.log('--- Account Summary ---');
    console.log('Admin (GM):    admin / admin123');
    console.log('Supplier:      metro / pass123  (Global Food Systems)');
    console.log('Supplier:      greenf / pass123 (Green Valley Farms)');
    console.log('------------------------');

    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
};

seed();
