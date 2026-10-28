
const { pool } = require("../config/db");

// GET all recipe ingredient rows
exports.getRecipes = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        r.id,
        r.menu_item_id,
        m.name AS menu_item_name,
        m.selling_price,
        r.ingredient_id,
        i.name AS ingredient_name,
        i.unit AS ingredient_unit,
        r.quantity_required,
        r.yield_quantity,
        r.yield_unit,
        r.instructions
      FROM recipes r
      INNER JOIN menu_items m ON m.id = r.menu_item_id
      INNER JOIN ingredients i ON i.id = r.ingredient_id
      ORDER BY m.name ASC, i.name ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Get recipes error:", error.message);
    res.status(500).json({
      message: "Could not load recipes",
      error: error.message,
    });
  }
};

// GET ingredients for dropdown
exports.getIngredients = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, name, unit, quantity
      FROM ingredients
      ORDER BY name ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Get ingredients error:", error.message);
    res.status(500).json({
      message: "Could not load ingredients",
      error: error.message,
    });
  }
};

// GET menu items for dropdown
exports.getMenuItems = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, name, selling_price, is_available
      FROM menu_items
      ORDER BY name ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Get menu items error:", error.message);
    res.status(500).json({
      message: "Could not load menu items",
      error: error.message,
    });
  }
};

// GET one recipe ingredient row by ID
exports.getRecipeById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        r.id,
        r.menu_item_id,
        m.name AS menu_item_name,
        m.selling_price,
        r.ingredient_id,
        i.name AS ingredient_name,
        i.unit AS ingredient_unit,
        r.quantity_required,
        r.yield_quantity,
        r.yield_unit,
        r.instructions
      FROM recipes r
      INNER JOIN menu_items m ON m.id = r.menu_item_id
      INNER JOIN ingredients i ON i.id = r.ingredient_id
      WHERE r.id = ?
      `,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Recipe ingredient not found.",
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Get recipe by ID error:", error.message);
    res.status(500).json({
      message: "Could not load recipe",
      error: error.message,
    });
  }
};

// CREATE one ingredient requirement
exports.createRecipe = async (req, res) => {
  try {
    const {
      menu_item_id,
      ingredient_id,
      quantity_required,
      yield_quantity = 1,
      yield_unit = "serving",
      instructions = null,
    } = req.body;

    if (
      !menu_item_id ||
      !ingredient_id ||
      quantity_required === "" ||
      quantity_required === undefined ||
      !Number.isFinite(Number(quantity_required)) ||
      Number(quantity_required) <= 0 ||
      !Number.isFinite(Number(yield_quantity)) ||
      Number(yield_quantity) <= 0 ||
      !String(yield_unit).trim()
    ) {
      return res.status(400).json({
        message: "Select a menu item and ingredient and enter valid quantities.",
      });
    }

    const [menuItems] = await pool.query(
      "SELECT id FROM menu_items WHERE id = ?",
      [Number(menu_item_id)]
    );

    if (!menuItems.length) {
      return res.status(404).json({ message: "Menu item not found." });
    }

    const [ingredients] = await pool.query(
      "SELECT id FROM ingredients WHERE id = ?",
      [Number(ingredient_id)]
    );

    if (!ingredients.length) {
      return res.status(404).json({ message: "Ingredient not found." });
    }

    const [existing] = await pool.query(
      `SELECT id FROM recipes
       WHERE menu_item_id = ? AND ingredient_id = ?`,
      [Number(menu_item_id), Number(ingredient_id)]
    );

    if (existing.length) {
      return res.status(409).json({
        message:
          "This ingredient already exists in this menu item's recipe. Edit its existing row instead.",
      });
    }

    const [result] = await pool.query(
      `INSERT INTO recipes
        (menu_item_id, ingredient_id, quantity_required,
         yield_quantity, yield_unit, instructions)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        Number(menu_item_id),
        Number(ingredient_id),
        Number(quantity_required),
        Number(yield_quantity),
        String(yield_unit).trim(),
        instructions || null,
      ]
    );

    res.status(201).json({
      message: "Recipe ingredient saved successfully.",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Create recipe error:", error.message);
    res.status(500).json({
      message: "Could not save recipe",
      error: error.message,
    });
  }
};

// UPDATE one ingredient requirement
exports.updateRecipe = async (req, res) => {
  try {
    const {
      menu_item_id,
      ingredient_id,
      quantity_required,
      yield_quantity = 1,
      yield_unit = "serving",
      instructions = null,
    } = req.body;

    const id = Number(req.params.id);

    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      !menu_item_id ||
      !ingredient_id ||
      quantity_required === "" ||
      quantity_required === undefined ||
      !Number.isFinite(Number(quantity_required)) ||
      Number(quantity_required) <= 0 ||
      !Number.isFinite(Number(yield_quantity)) ||
      Number(yield_quantity) <= 0 ||
      !String(yield_unit).trim()
    ) {
      return res.status(400).json({
        message: "Enter valid menu item, ingredient, and quantities.",
      });
    }

    const [result] = await pool.query(
      `UPDATE recipes
       SET menu_item_id = ?,
           ingredient_id = ?,
           quantity_required = ?,
           yield_quantity = ?,
           yield_unit = ?,
           instructions = ?
       WHERE id = ?`,
      [
        Number(menu_item_id),
        Number(ingredient_id),
        Number(quantity_required),
        Number(yield_quantity),
        String(yield_unit).trim(),
        instructions || null,
        id,
      ]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Recipe ingredient not found.",
      });
    }

    res.json({ message: "Recipe ingredient updated successfully." });
  } catch (error) {
    console.error("Update recipe error:", error.message);
    res.status(500).json({
      message: "Could not update recipe",
      error: error.message,
    });
  }
};

// DELETE one ingredient requirement
exports.deleteRecipe = async (req, res) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM recipes WHERE id = ?",
      [req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Recipe ingredient not found.",
      });
    }

    res.json({ message: "Recipe ingredient deleted successfully." });
  } catch (error) {
    console.error("Delete recipe error:", error.message);
    res.status(500).json({
      message: "Could not delete recipe",
      error: error.message,
    });
  }
};
