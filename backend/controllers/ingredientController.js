
const { pool } = require("../config/db");

const units = ["g", "kg", "ml", "l", "pcs"];

// GET /api/ingredients
async function getIngredients(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT
        id,
        name,
        unit,
        quantity,
        min_stock,
        cost_per_unit,
        created_at
      FROM ingredients
      ORDER BY id DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Get ingredients error:", error.message);
    res.status(500).json({
      message: "Failed to fetch ingredients",
      error: error.message,
    });
  }
}

// POST /api/ingredients
async function createIngredient(req, res) {
  const {
    name,
    unit = "kg",
    quantity = 0,
    min_stock = 5,
    cost_per_unit = 0,
  } = req.body;

  const stock = Number(quantity);
  const minimum = Number(min_stock);
  const cost = Number(cost_per_unit);

  if (!name?.trim() || !units.includes(unit)) {
    return res.status(400).json({
      message: "Valid ingredient name and unit are required",
    });
  }

  if (
    !Number.isFinite(stock) || stock < 0 ||
    !Number.isFinite(minimum) || minimum < 0 ||
    !Number.isFinite(cost) || cost < 0
  ) {
    return res.status(400).json({
      message: "Quantity, minimum stock and cost must be non-negative numbers",
    });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO ingredients
        (name, unit, quantity, min_stock, cost_per_unit)
       VALUES (?, ?, ?, ?, ?)`,
      [name.trim(), unit, stock, minimum, cost]
    );

    res.status(201).json({
      id: result.insertId,
      message: "Ingredient created successfully",
    });
  } catch (error) {
    console.error("Create ingredient error:", error.message);
    res.status(500).json({
      message: "Failed to create ingredient",
      error: error.message,
    });
  }
}

// PUT /api/ingredients/:id
async function updateIngredient(req, res) {
  const { name, unit, quantity, min_stock, cost_per_unit } = req.body;

  const stock = Number(quantity);
  const minimum = Number(min_stock);
  const cost = Number(cost_per_unit);

  if (
    !name?.trim() || !units.includes(unit) ||
    !Number.isFinite(stock) || stock < 0 ||
    !Number.isFinite(minimum) || minimum < 0 ||
    !Number.isFinite(cost) || cost < 0
  ) {
    return res.status(400).json({
      message: "Invalid ingredient details",
    });
  }

  try {
    const [result] = await pool.query(
      `UPDATE ingredients
       SET name = ?, unit = ?, quantity = ?,
           min_stock = ?, cost_per_unit = ?
       WHERE id = ?`,
      [
        name.trim(),
        unit,
        stock,
        minimum,
        cost,
        req.params.id,
      ]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Ingredient not found",
      });
    }

    res.json({ message: "Ingredient updated successfully" });
  } catch (error) {
    console.error("Update ingredient error:", error.message);
    res.status(500).json({
      message: "Failed to update ingredient",
      error: error.message,
    });
  }
}

// DELETE /api/ingredients/:id
async function deleteIngredient(req, res) {
  try {
    const [result] = await pool.query(
      "DELETE FROM ingredients WHERE id = ?",
      [req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Ingredient not found",
      });
    }

    res.json({ message: "Ingredient deleted successfully" });
  } catch (error) {
    console.error("Delete ingredient error:", error.message);
    res.status(500).json({
      message: "Could not delete ingredient",
      error: error.message,
    });
  }
}

async function getStockAlerts(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT
        id,
        name,
        quantity,
        min_stock,
        unit,
        CASE
          WHEN quantity <= 0 THEN 'OUT_OF_STOCK'
          ELSE 'LOW_STOCK'
        END AS stock_status
      FROM ingredients
      WHERE quantity <= min_stock OR quantity <= 0
      ORDER BY quantity ASC, name ASC
    `);

    const outOfStock = rows.filter(
      item => Number(item.quantity) <= 0
    ).length;

    res.json({
      total_alerts: rows.length,
      out_of_stock: outOfStock,
      low_stock: rows.length - outOfStock,
      ingredients: rows
    });
  } catch (error) {
    console.error("Stock alerts error:", error.message);
    res.status(500).json({
      message: "Failed to load stock alerts"
    });
  }
}

module.exports = {
  getIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  getStockAlerts
};