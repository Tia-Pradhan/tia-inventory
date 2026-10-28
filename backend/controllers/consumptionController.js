
const { pool } = require("../config/db");

// GET /api/consumption/history
exports.getConsumptionHistory = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        sc.id,
        sc.ingredient_id,
        i.name AS ingredient_name,
        i.unit,
        sc.menu_item_id,
        m.name AS menu_item_name,
        sc.quantity,
        sc.source,
        sc.notes,
        sc.created_at,
        CASE
          WHEN LOWER(COALESCE(sc.source, '')) = 'sale'
            AND COALESCE(sc.notes, '') REGEXP 'Sale #[0-9]+'
          THEN REGEXP_SUBSTR(sc.notes, 'Sale #[0-9]+')
          ELSE NULL
        END AS sale_reference
      FROM stock_consumption sc
      INNER JOIN ingredients i
        ON i.id = sc.ingredient_id
      LEFT JOIN menu_items m
        ON m.id = sc.menu_item_id
      ORDER BY sc.created_at DESC, sc.id DESC
    `);

    return res.json(rows);
  } catch (error) {
    console.error("Consumption history error:", error);
    return res.status(500).json({
      message: "Failed to load stock consumption history",
    });
  }
};

// GET /api/consumption/summary
exports.getConsumptionSummary = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        i.id AS ingredient_id,
        i.name AS ingredient_name,
        i.unit,
        COALESCE(SUM(sc.quantity), 0) AS total_consumed
      FROM ingredients i
      LEFT JOIN stock_consumption sc
        ON sc.ingredient_id = i.id
      GROUP BY i.id, i.name, i.unit
      ORDER BY total_consumed DESC, i.name
    `);

    return res.json(rows);
  } catch (error) {
    console.error("Consumption summary error:", error);
    return res.status(500).json({
      message: "Failed to load consumption summary",
    });
  }
};

// POST /api/consumption
// Record manual consumption and deduct stock atomically.
exports.createConsumption = async (req, res) => {
  const { ingredient_id, quantity, menu_item_id, notes } = req.body;

  const ingredientId = Number(ingredient_id);
  const amount = Number(quantity);
  const menuItemId =
    menu_item_id === "" ||
    menu_item_id === null ||
    menu_item_id === undefined
      ? null
      : Number(menu_item_id);

  if (
    !Number.isInteger(ingredientId) ||
    ingredientId <= 0 ||
    quantity === "" ||
    quantity === null ||
    quantity === undefined ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return res.status(400).json({
      message: "Select an ingredient and enter a positive quantity.",
    });
  }

  if (
    menuItemId !== null &&
    (!Number.isInteger(menuItemId) || menuItemId <= 0)
  ) {
    return res.status(400).json({
      message: "Invalid menu item.",
    });
  }

  if (notes != null && typeof notes !== "string") {
    return res.status(400).json({
      message: "Notes must be text.",
    });
  }

  if (typeof notes === "string" && notes.length > 500) {
    return res.status(400).json({
      message: "Notes must be 500 characters or fewer.",
    });
  }

  let connection;
  let transactionStarted = false;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [ingredientRows] = await connection.query(
      `SELECT id, name, quantity
       FROM ingredients
       WHERE id = ?
       FOR UPDATE`,
      [ingredientId]
    );

    if (ingredientRows.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({
        message: "Ingredient not found.",
      });
    }

    const ingredient = ingredientRows[0];
    const currentStock = Number(ingredient.quantity);

    if (
      !Number.isFinite(currentStock) ||
      currentStock < 0 ||
      amount > currentStock
    ) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({
        message: `Insufficient stock. Available: ${ingredient.quantity}.`,
      });
    }

    if (menuItemId !== null) {
      const [menuRows] = await connection.query(
        "SELECT id FROM menu_items WHERE id = ?",
        [menuItemId]
      );

      if (menuRows.length === 0) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(404).json({
          message: "Menu item not found.",
        });
      }
    }

    await connection.query(
      `INSERT INTO stock_consumption
        (ingredient_id, menu_item_id, quantity, source, notes)
       VALUES (?, ?, ?, 'manual', ?)`,
      [ingredientId, menuItemId, amount, notes?.trim() || null]
    );

    await connection.query(
      `UPDATE ingredients
       SET quantity = quantity - ?
       WHERE id = ?`,
      [amount, ingredientId]
    );

    await connection.commit();
    transactionStarted = false;

    return res.status(201).json({
      message: "Consumption recorded and stock updated successfully.",
      ingredient_name: ingredient.name,
      previous_stock: currentStock,
      consumed_quantity: amount,
      remaining_stock: Number((currentStock - amount).toFixed(3)),
    });
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback().catch(() => {});
    }

    console.error("Create consumption error:", error);
    return res.status(500).json({
      message: "Failed to record stock consumption.",
    });
  } finally {
    if (connection) connection.release();
  }
};
