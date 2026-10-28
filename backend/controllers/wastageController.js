
const { pool } = require("../config/db");

// GET /api/wastage/history
exports.getWastageHistory = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        w.id,
        w.ingredient_id,
        i.name AS ingredient_name,
        i.unit AS ingredient_unit,
        w.quantity,
        w.reason,
        w.notes,
        w.recorded_by,
        w.created_at
      FROM wastage_records w
      INNER JOIN ingredients i
        ON i.id = w.ingredient_id
      ORDER BY w.created_at DESC, w.id DESC
    `);

    return res.json(rows);
  } catch (error) {
    console.error("Wastage history error:", error);

    return res.status(500).json({
      message: "Could not load wastage history.",
    });
  }
};

// GET /api/wastage/reports?from=2026-10-01&to=2026-10-28
exports.getWastageReport = async (req, res) => {
  try {
    const { from, to } = req.query;

    const isValidDate = (value) => {
      if (typeof value !== "string") return false;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

      const date = new Date(`${value}T00:00:00Z`);

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    };

    if (from && !isValidDate(from)) {
      return res.status(400).json({
        message: "Invalid start date. Use YYYY-MM-DD.",
      });
    }

    if (to && !isValidDate(to)) {
      return res.status(400).json({
        message: "Invalid end date. Use YYYY-MM-DD.",
      });
    }

    if (from && to && from > to) {
      return res.status(400).json({
        message: "Start date cannot be after end date.",
      });
    }

    const conditions = [];
    const params = [];

    if (from) {
      conditions.push("w.created_at >= ?");
      params.push(`${from} 00:00:00`);
    }

    if (to) {
      conditions.push(
        "w.created_at < DATE_ADD(?, INTERVAL 1 DAY)"
      );
      params.push(`${to} 00:00:00`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const [
      [summaryRows],
      [unitRows],
      [reasonRows],
      [ingredientRows],
      [dailyRows],
    ] = await Promise.all([
      // Summary cards
      pool.query(
        `SELECT
           COUNT(*) AS total_records,
           COUNT(DISTINCT w.ingredient_id) AS ingredients_affected
         FROM wastage_records w
         ${whereClause}`,
        params
      ),

      // Total quantities, separated by unit
      pool.query(
        `SELECT
           i.unit,
           COALESCE(SUM(w.quantity), 0) AS total_quantity,
           COUNT(*) AS record_count
         FROM wastage_records w
         INNER JOIN ingredients i
           ON i.id = w.ingredient_id
         ${whereClause}
         GROUP BY i.unit
         ORDER BY i.unit`,
        params
      ),

      // Wastage by reason
      pool.query(
        `SELECT
           w.reason,
           COUNT(*) AS record_count
         FROM wastage_records w
         ${whereClause}
         GROUP BY w.reason
         ORDER BY record_count DESC, w.reason`,
        params
      ),

      // Wastage by ingredient
      pool.query(
        `SELECT
           w.ingredient_id,
           i.name AS ingredient_name,
           i.unit AS ingredient_unit,
           SUM(w.quantity) AS total_quantity,
           COUNT(*) AS record_count
         FROM wastage_records w
         INNER JOIN ingredients i
           ON i.id = w.ingredient_id
         ${whereClause}
         GROUP BY w.ingredient_id, i.name, i.unit
         ORDER BY total_quantity DESC, i.name`,
        params
      ),

      // Daily wastage trend
      pool.query(
        `SELECT
           DATE(w.created_at) AS wastage_date,
           COUNT(*) AS record_count
         FROM wastage_records w
         ${whereClause}
         GROUP BY DATE(w.created_at)
         ORDER BY wastage_date ASC`,
        params
      ),
    ]);

    return res.json({
      filters: {
        from: from || null,
        to: to || null,
      },

      summary: {
        total_records: Number(summaryRows[0].total_records),
        ingredients_affected: Number(
          summaryRows[0].ingredients_affected
        ),
      },

      quantity_by_unit: unitRows.map((row) => ({
        unit: row.unit,
        total_quantity: Number(row.total_quantity),
        record_count: Number(row.record_count),
      })),

      by_reason: reasonRows.map((row) => ({
        reason: row.reason,
        record_count: Number(row.record_count),
      })),

      by_ingredient: ingredientRows.map((row) => ({
        ingredient_id: row.ingredient_id,
        ingredient_name: row.ingredient_name,
        ingredient_unit: row.ingredient_unit,
        total_quantity: Number(row.total_quantity),
        record_count: Number(row.record_count),
      })),

      daily_trend: dailyRows.map((row) => ({
        date: row.wastage_date,
        record_count: Number(row.record_count),
      })),
    });
  } catch (error) {
    console.error("Wastage report error:", error);

    return res.status(500).json({
      message: "Could not generate wastage report.",
    });
  }
};

// POST /api/wastage
// Record wastage, deduct stock and log the stock movement.
exports.recordWastage = async (req, res) => {
  const {
    ingredient_id,
    quantity,
    reason,
    notes,
    recorded_by,
  } = req.body;

  const ingredientId = Number(ingredient_id);
  const wastageQuantity = Number(quantity);

  const allowedReasons = [
    "SPOILAGE",
    "EXPIRY",
    "PREPARATION_WASTE",
    "DAMAGE",
    "OVERPRODUCTION",
    "OTHER",
  ];

  const normalizedReason =
    typeof reason === "string" ? reason.trim().toUpperCase() : "";

  if (
    !Number.isInteger(ingredientId) ||
    ingredientId <= 0 ||
    quantity === "" ||
    quantity === null ||
    quantity === undefined ||
    !Number.isFinite(wastageQuantity) ||
    wastageQuantity <= 0 ||
    !allowedReasons.includes(normalizedReason)
  ) {
    return res.status(400).json({
      message: "Enter a valid ingredient, positive quantity, and reason.",
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

    const [ingredients] = await connection.query(
      `SELECT id, name, unit, quantity
       FROM ingredients
       WHERE id = ?
       FOR UPDATE`,
      [ingredientId]
    );

    if (ingredients.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        message: "Ingredient not found.",
      });
    }

    const ingredient = ingredients[0];
    const previousQuantity = Number(ingredient.quantity);

    if (
      !Number.isFinite(previousQuantity) ||
      previousQuantity < 0
    ) {
      throw new Error("Ingredient stock quantity is invalid.");
    }

    if (wastageQuantity > previousQuantity) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(409).json({
        message: "Insufficient stock. Wastage was not recorded.",
        available: previousQuantity,
        requested: wastageQuantity,
      });
    }

    const newQuantity = Number(
      (previousQuantity - wastageQuantity).toFixed(3)
    );

    const [update] = await connection.query(
      `UPDATE ingredients
       SET quantity = quantity - ?
       WHERE id = ? AND quantity >= ?`,
      [wastageQuantity, ingredientId, wastageQuantity]
    );

    if (update.affectedRows !== 1) {
      throw new Error("Ingredient stock update failed.");
    }

    const [wastage] = await connection.query(
      `INSERT INTO wastage_records
        (ingredient_id, quantity, reason, notes, recorded_by)
       VALUES (?, ?, ?, ?, ?)`,
      [
        ingredientId,
        wastageQuantity,
        normalizedReason,
        typeof notes === "string" ? notes.trim() || null : null,
        typeof recorded_by === "string" && recorded_by.trim()
          ? recorded_by.trim()
          : "Admin",
      ]
    );

    await connection.query(
      `INSERT INTO stock_movements
        (
          ingredient_id,
          movement_type,
          quantity,
          notes,
          previous_quantity,
          new_quantity
        )
       VALUES (?, 'OUT', ?, ?, ?, ?)`,
      [
        ingredientId,
        wastageQuantity,
        `Wastage #${wastage.insertId}: ${normalizedReason}`,
        previousQuantity,
        newQuantity,
      ]
    );

    await connection.commit();
    transactionStarted = false;

    return res.status(201).json({
      message: "Wastage recorded and stock deducted successfully.",
      wastage_id: wastage.insertId,
      ingredient: ingredient.name,
      quantity_wasted: wastageQuantity,
      unit: ingredient.unit,
      previous_stock: previousQuantity,
      remaining_stock: newQuantity,
    });
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback().catch((rollbackError) => {
        console.error("Wastage rollback error:", rollbackError);
      });
    }

    console.error("Record wastage error:", error);

    return res.status(500).json({
      message: "Could not record wastage.",
      error: error.message,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
