
const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");

// GET all ingredients
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM ingredients ORDER BY name ASC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Get ingredients error:", error);
    res.status(500).json({ message: "Failed to fetch ingredients" });
  }
});

// POST create ingredient
router.post("/", async (req, res) => {
  try {
    const {
      name,
      unit,
      quantity,
      min_stock,
      cost_per_unit,
    } = req.body;

    if (!name || !unit) {
      return res.status(400).json({
        message: "Ingredient name and unit are required",
      });
    }

    const stock = Number(quantity ?? 0);
    const minimum = Number(min_stock ?? 0);
    const cost = Number(cost_per_unit ?? 0);

    if (
      !Number.isFinite(stock) ||
      stock < 0 ||
      !Number.isFinite(minimum) ||
      minimum < 0 ||
      !Number.isFinite(cost) ||
      cost < 0
    ) {
      return res.status(400).json({
        message: "Quantity, minimum stock, and cost must be non-negative numbers",
      });
    }

    const [result] = await pool.query(
      `INSERT INTO ingredients
       (name, unit, quantity, min_stock, cost_per_unit)
       VALUES (?, ?, ?, ?, ?)`,
      [name.trim(), unit, stock, minimum, cost]
    );

    const [rows] = await pool.query(
      "SELECT * FROM ingredients WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json({
      message: "Ingredient added successfully",
      ingredient: rows[0],
    });
  } catch (error) {
    console.error("Create ingredient error:", error);
    res.status(500).json({
      message: "Failed to add ingredient",
      error: error.message,
    });
  }
});

module.exports = router;
