const { pool } = require("../config/db");

// Get all menu items
const getMenuItems = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        id,
        name,
        description,
        selling_price,
        is_available,
        created_at
      FROM menu_items
      ORDER BY id DESC
    `);

    return res.json(rows);
  } catch (error) {
    console.error("Get menu items error:", error);
    return res.status(500).json({
      message: "Could not load menu items.",
    });
  }
};

// Get one menu item
const getMenuItem = async (req, res) => {
  try {
    const menuItemId = Number(req.params.id);

    if (!Number.isInteger(menuItemId) || menuItemId <= 0) {
      return res.status(400).json({
        message: "Invalid menu item ID.",
      });
    }

    const [rows] = await pool.query(
      "SELECT * FROM menu_items WHERE id = ?",
      [menuItemId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Menu item not found.",
      });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error("Get menu item error:", error);
    return res.status(500).json({
      message: "Could not load menu item.",
    });
  }
};

// Create menu item
const createMenuItem = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      selling_price,
      is_available,
    } = req.body;

    const itemName =
      typeof name === "string" ? name.trim() : "";

    const rawPrice = selling_price ?? price;
    const itemPrice =
      rawPrice === "" || rawPrice == null
        ? NaN
        : Number(rawPrice);

    if (
      !itemName ||
      !Number.isFinite(itemPrice) ||
      itemPrice < 0
    ) {
      return res.status(400).json({
        message: "A valid menu item name and price are required.",
      });
    }

    if (
      description != null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        message: "Description must be text.",
      });
    }

    const available =
      is_available === undefined
        ? 1
        : is_available === true ||
          is_available === 1 ||
          is_available === "1"
        ? 1
        : 0;

    const [result] = await pool.query(
      `INSERT INTO menu_items
        (name, description, selling_price, is_available)
       VALUES (?, ?, ?, ?)`,
      [
        itemName,
        description?.trim() || null,
        itemPrice,
        available,
      ]
    );

    return res.status(201).json({
      message: "Menu item created successfully.",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Create menu item error:", error);
    return res.status(500).json({
      message: "Could not create menu item.",
    });
  }
};

// Update menu item
const updateMenuItem = async (req, res) => {
  try {
    const menuItemId = Number(req.params.id);

    if (!Number.isInteger(menuItemId) || menuItemId <= 0) {
      return res.status(400).json({
        message: "Invalid menu item ID.",
      });
    }

    const {
      name,
      description,
      price,
      selling_price,
      is_available,
    } = req.body;

    const itemName =
      typeof name === "string" ? name.trim() : "";

    const rawPrice = selling_price ?? price;
    const itemPrice =
      rawPrice === "" || rawPrice == null
        ? NaN
        : Number(rawPrice);

    if (
      !itemName ||
      !Number.isFinite(itemPrice) ||
      itemPrice < 0
    ) {
      return res.status(400).json({
        message: "A valid menu item name and price are required.",
      });
    }

    if (
      description != null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        message: "Description must be text.",
      });
    }

    const available =
      is_available === undefined
        ? 1
        : is_available === true ||
          is_available === 1 ||
          is_available === "1"
        ? 1
        : 0;

    const [result] = await pool.query(
      `UPDATE menu_items
       SET name = ?,
           description = ?,
           selling_price = ?,
           is_available = ?
       WHERE id = ?`,
      [
        itemName,
        description?.trim() || null,
        itemPrice,
        available,
        menuItemId,
      ]
    );

    if (result.affectedRows === 0) {
      const [existing] = await pool.query(
        "SELECT id FROM menu_items WHERE id = ?",
        [menuItemId]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          message: "Menu item not found.",
        });
      }
    }

    return res.json({
      message: "Menu item updated successfully.",
    });
  } catch (error) {
    console.error("Update menu item error:", error);
    return res.status(500).json({
      message: "Could not update menu item.",
    });
  }
};

// Delete menu item safely
const deleteMenuItem = async (req, res) => {
  try {
    const menuItemId = Number(req.params.id);

    if (!Number.isInteger(menuItemId) || menuItemId <= 0) {
      return res.status(400).json({
        message: "Invalid menu item ID.",
      });
    }

    const [items] = await pool.query(
      "SELECT id FROM menu_items WHERE id = ?",
      [menuItemId]
    );

    if (items.length === 0) {
      return res.status(404).json({
        message: "Menu item not found.",
      });
    }

    // Preserve sales history. Never delete associated sales.
    const [sales] = await pool.query(
      `SELECT id
       FROM sale_items
       WHERE menu_item_id = ?
       LIMIT 1`,
      [menuItemId]
    );

    if (sales.length > 0) {
      return res.status(409).json({
        message:
          "This menu item is linked to sales history and cannot be deleted. Edit the item and mark it unavailable instead.",
        code: "MENU_ITEM_HAS_SALES",
      });
    }

    // Delete only if there are no historical sale references.
    await pool.query(
      "DELETE FROM menu_items WHERE id = ?",
      [menuItemId]
    );

    return res.json({
      message: "Menu item deleted successfully.",
    });
  } catch (error) {
    console.error("Delete menu item error:", error);

    // Protect against other foreign-key references too.
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        message:
          "This menu item is referenced by other records and cannot be deleted. Mark it unavailable instead.",
        code: "MENU_ITEM_REFERENCED",
      });
    }

    return res.status(500).json({
      message: "Could not delete menu item.",
    });
  }
};

module.exports = {
  getMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
};
