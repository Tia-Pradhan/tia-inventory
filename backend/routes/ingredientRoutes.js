
const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");

// GET: Fetch all ingredients
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, name, unit, quantity, min_stock, cost_per_unit, created_at
      FROM ingredients
      ORDER BY name ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Fetch ingredients error:", error);
    res.status(500).json({
      message: "Failed to fetch ingredients",
      error: error.message,
    });
  }
});

// POST: Add a new ingredient
router.post("/", async (req, res) => {
  try {
    const {
      name,
      unit = "kg",
      quantity = 0,
      min_stock = 5,
      cost_per_unit = 0,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Ingredient name is required",
      });
    }

    const stock = Number(quantity);
    const minimum = Number(min_stock);
    const cost = Number(cost_per_unit);

    if (
      !Number.isFinite(stock) || stock < 0 ||
      !Number.isFinite(minimum) || minimum < 0 ||
      !Number.isFinite(cost) || cost < 0
    ) {
      return res.status(400).json({
        message: "Stock, minimum stock and cost must be non-negative numbers",
      });
    }

    const [result] = await pool.query(
      `INSERT INTO ingredients
       (name, unit, quantity, min_stock, cost_per_unit)
       VALUES (?, ?, ?, ?, ?)`,
      [name.trim(), unit, stock, minimum, cost]
    );

    const [rows] = await pool.query(
      `SELECT id, name, unit, quantity, min_stock, cost_per_unit, created_at
       FROM ingredients WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: "Ingredient added successfully",
      ingredient: rows[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "An ingredient with this name already exists",
      });
    }

    console.error("Add ingredient error:", error);
    res.status(500).json({
      message: "Failed to add ingredient",
      error: error.message,
    });
  }
});

// PUT: Update an existing ingredient
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, unit, quantity, min_stock, cost_per_unit } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid ingredient ID" });
    }

    if (!name || !name.trim() || !unit) {
      return res.status(400).json({
        message: "Ingredient name and unit are required",
      });
    }

    const stock = Number(quantity);
    const minimum = Number(min_stock);
    const cost = Number(cost_per_unit);

    if (
      !Number.isFinite(stock) || stock < 0 ||
      !Number.isFinite(minimum) || minimum < 0 ||
      !Number.isFinite(cost) || cost < 0
    ) {
      return res.status(400).json({
        message: "Stock, minimum stock and cost must be non-negative numbers",
      });
    }

    const [result] = await pool.query(
      `UPDATE ingredients
       SET name = ?, unit = ?, quantity = ?, min_stock = ?, cost_per_unit = ?
       WHERE id = ?`,
      [name.trim(), unit, stock, minimum, cost, id]
    );

    if (result.affectedRows === 0) {
      const [existing] = await pool.query(
        "SELECT id FROM ingredients WHERE id = ?",
        [id]
      );

      if (existing.length === 0) {
        return res.status(404).json({ message: "Ingredient not found" });
      }
    }

    const [rows] = await pool.query(
      `SELECT id, name, unit, quantity, min_stock, cost_per_unit, created_at
       FROM ingredients WHERE id = ?`,
      [id]
    );

    res.json({
      message: "Ingredient updated successfully",
      ingredient: rows[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "An ingredient with this name already exists",
      });
    }

    console.error("Update ingredient error:", error);
    res.status(500).json({
      message: "Failed to update ingredient",
      error: error.message,
    });
  }
});

// DELETE: Delete only ingredients that are not used in recipes
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid ingredient ID" });
    }

    const [ingredients] = await pool.query(
      "SELECT id, name FROM ingredients WHERE id = ?",
      [id]
    );

    if (ingredients.length === 0) {
      return res.status(404).json({ message: "Ingredient not found" });
    }

    // Check recipe references before attempting deletion
    const [recipes] = await pool.query(
      `SELECT r.id, m.name AS menu_item_name
       FROM recipes r
       LEFT JOIN menu_items m ON m.id = r.menu_item_id
       WHERE r.ingredient_id = ?
       LIMIT 5`,
      [id]
    );

    if (recipes.length > 0) {
      return res.status(409).json({
        message: "Cannot delete this ingredient because it is used in a recipe. Remove it from the recipe first.",
        recipes: recipes.map((recipe) => recipe.menu_item_name || "Unnamed menu item"),
      });
    }

    await pool.query("DELETE FROM ingredients WHERE id = ?", [id]);

    res.json({
      message: "Ingredient deleted successfully",
      id,
    });
  } catch (error) {
    // Other tables, such as stock history, may also reference this ingredient.
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        message: "This ingredient is referenced by existing records and cannot be deleted. Keep it for stock history, or mark it inactive instead.",
      });
    }

    console.error("Delete ingredient error:", error);
    res.status(500).json({
      message: "Failed to delete ingredient",
      error: error.message,
    });
  }
});

module.exports = router;
