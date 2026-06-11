import { Router } from "express";
import { User } from "../models/User.js";
import { Department } from "../models/Department.js";
import { Category } from "../models/Category.js";

const router = Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username, password, active: true })
      .populate('department')
      .populate('supplier');
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    
    const userObj = user.toObject();
    delete userObj.password;
    
    // Flatten department for frontend compatibility if needed
    if (userObj.department) {
      userObj.department_name = userObj.department.name;
      userObj.department_code = userObj.department.code;
      userObj.department_id = userObj.department._id;
    }
    if (userObj.supplier) {
      userObj.supplier_id = userObj.supplier._id;
      userObj.supplier_name = userObj.supplier.name;
    }
    
    res.json(userObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await User.find({ active: true }).populate('department');
    res.json(users.map(u => {
      const obj = u.toObject();
      if (obj.department) {
        obj.department_name = obj.department.name;
      }
      return obj;
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/departments", async (req, res) => {
  try {
    const depts = await Department.find();
    res.json(depts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/categories", async (req, res) => {
  try {
    const cats = await Category.find();
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
