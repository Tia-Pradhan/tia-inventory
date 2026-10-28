
const { pool } = require("../config/db");

// GET /api/inventory
async function getInventory(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT
        i.*,
        p.name AS productName,
        p.sku,
        c.name AS categoryName,
        CASE
          WHEN i.quantity <= 0 THEN 'out-of-stock'
          WHEN i.quantity <= i.reorder_level THEN 'low-stock'
          ELSE 'in-stock'
        END AS stockStatus
      FROM inventory i
      INNER JOIN products p ON p.id = i.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.name ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Get inventory error:", error);
    res.status(500).json({
      message: "Failed to fetch inventory",
      error: error.message
    });
  }
}

// GET /api/inventory/:productId
async function getInventoryItem(req, res) {
  try {
    const productId = Number(req.params.productId);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const [rows] = await pool.query(`
      SELECT i.*, p.name AS productName, p.sku
      FROM inventory i
      INNER JOIN products p ON p.id = i.product_id
      WHERE i.product_id = ?
    `, [productId]);

    if (!rows.length) {
      return res.status(404).json({
        message: "Inventory item not found"
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Get inventory item error:", error);
    res.status(500).json({
      message: "Failed to fetch inventory item",
      error: error.message
    });
  }
}

// Shared stock update function
async function changeStock(req, res, type) {
  const { productId, quantity, newQuantity, reason } = req.body;

  const id = Number(productId);
  const amount = Number(quantity);
  const target = Number(newQuantity);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      message: "Please select a valid product"
    });
  }

  if (typeof reason !== "string" || !reason.trim()) {
    return res.status(400).json({
      message: "Reason is required"
    });
  }

  if (type === "adjustment") {
    if (
      newQuantity === undefined ||
      newQuantity === null ||
      newQuantity === "" ||
      !Number.isFinite(target) ||
      target < 0
    ) {
      return res.status(400).json({
        message: "Enter a valid new quantity"
      });
    }
  } else if (
    quantity === undefined ||
    quantity === null ||
    quantity === "" ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return res.status(400).json({
      message: "Quantity must be greater than zero"
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT quantity
       FROM inventory
       WHERE product_id = ?
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await connection.rollback();

      return res.status(404).json({
        message: "Inventory item not found"
      });
    }

    const previous = Number(rows[0].quantity);
    let next;
    let movementType;

    if (type === "stock-in") {
      next = previous + amount;
      movementType = "IN";
    } else if (type === "stock-out") {
      next = previous - amount;
      movementType = "OUT";
    } else {
      next = target;
      movementType = "ADJUSTMENT";
    }

    if (next < 0) {
      await connection.rollback();

      return res.status(409).json({
        message: `Stock out quantity cannot exceed current stock (${previous}).`,
        currentQuantity: previous
      });
    }

    const movementQuantity =
      type === "adjustment"
        ? Math.abs(next - previous)
        : amount;

    await connection.query(
      `UPDATE inventory
       SET quantity = ?
       WHERE product_id = ?`,
      [next, id]
    );

    // Save movement using the existing stock_movements column names.
    // previous_quantity and new_quantity must exist in MySQL.
    await connection.query(
      `INSERT INTO stock_movements
       (product_id, movement_type, quantity, notes,
        previous_quantity, new_quantity)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        movementType,
        movementQuantity,
        reason.trim(),
        previous,
        next
      ]
    );

    await connection.commit();

    res.json({
      message: "Stock updated successfully",
      productId: id,
      previousQuantity: previous,
      newQuantity: next
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError);
      }
    }

    console.error("Stock update error:", error);

    res.status(500).json({
      message: "Failed to update stock",
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
}

const stockIn = (req, res) =>
  changeStock(req, res, "stock-in");

const stockOut = (req, res) =>
  changeStock(req, res, "stock-out");

const adjustStock = (req, res) =>
  changeStock(req, res, "adjustment");

// GET /api/inventory/history
async function getStockHistory(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT
        sm.id,
        sm.product_id,
        sm.ingredient_id,
        sm.movement_type,
        sm.quantity,
        sm.notes,
        sm.created_at,
        sm.previous_quantity AS previousQuantity,
        sm.new_quantity AS newQuantity,
        p.name AS productName,
        p.sku,
        i.name AS ingredientName,
        i.unit AS ingredientUnit
      FROM stock_movements sm
      LEFT JOIN products p
        ON p.id = sm.product_id
      LEFT JOIN ingredients i
        ON i.id = sm.ingredient_id
      ORDER BY sm.created_at DESC, sm.id DESC
    `);

    const history = rows.map((row) => {
      const movementType = String(
        row.movement_type || ""
      ).toUpperCase();

      const isIngredient = row.ingredient_id != null;

      return {
        ...row,
        productName:
          row.productName ||
          row.ingredientName ||
          "Unknown item",
        sku: row.sku || "-",
        itemType: isIngredient ? "ingredient" : "product",
        type: movementType,
        operation: movementType,
        reason: row.notes || "-",
        createdAt: row.created_at
      };
    });

    res.json(history);
  } catch (error) {
    console.error("Get stock history error:", error);

    res.status(500).json({
      message: "Failed to fetch stock history",
      error: error.message
    });
  }
}

module.exports = {
  getInventory,
  getInventoryItem,
  stockIn,
  stockOut,
  adjustStock,
  getStockHistory
};
