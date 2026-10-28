
const { pool } = require("../config/db");

// GET /api/sales — fetch recent sales for the dashboard
exports.getSales = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        s.id,
        s.total_amount,
        s.status,
        s.created_at,
        s.customer_id,
        COUNT(si.id) AS item_count
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      GROUP BY
        s.id,
        s.total_amount,
        s.status,
        s.created_at,
        s.customer_id
      ORDER BY s.created_at DESC, s.id DESC
      LIMIT 100
    `);

    return res.json(rows);
  } catch (error) {
    console.error("Get sales error:", error);

    return res.status(500).json({
      message: "Could not load sales.",
    });
  }
};

// POST /api/sales — create a sale and deduct recipe ingredients
exports.createSale = async (req, res) => {
  const { items, customer_id = null } = req.body;

  const customerId =
    customer_id === null || customer_id === ""
      ? null
      : Number(customer_id);

  if (
    customerId !== null &&
    (!Number.isInteger(customerId) || customerId <= 0)
  ) {
    return res.status(400).json({
      message: "Invalid customer ID.",
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      message: "Add at least one menu item to the sale.",
    });
  }

  // Validate items and combine duplicate menu items.
  const itemQuantities = new Map();

  for (const item of items) {
    const menuItemId = Number(item.menu_item_id);
    const quantity = Number(item.quantity);

    if (
      !Number.isInteger(menuItemId) ||
      menuItemId <= 0 ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return res.status(400).json({
        message:
          "Each item needs a valid menu item ID and positive whole-number quantity.",
      });
    }

    itemQuantities.set(
      menuItemId,
      (itemQuantities.get(menuItemId) || 0) + quantity
    );
  }

  let connection;
  let transactionStarted = false;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    // Validate customer.
    if (customerId !== null) {
      const [customerRows] = await connection.query(
        "SELECT id FROM customers WHERE id = ? FOR UPDATE",
        [customerId]
      );

      if (customerRows.length === 0) {
        throw Object.assign(
          new Error("Selected customer was not found."),
          { statusCode: 404 }
        );
      }
    }

    const menuItemIds = [...itemQuantities.keys()].sort(
      (a, b) => a - b
    );

    const placeholders = menuItemIds.map(() => "?").join(",");

    // Lock menu items and retrieve prices.
    const [menuItems] = await connection.query(
      `SELECT id, name, selling_price, is_available
       FROM menu_items
       WHERE id IN (${placeholders})
       ORDER BY id
       FOR UPDATE`,
      menuItemIds
    );

    if (menuItems.length !== menuItemIds.length) {
      throw Object.assign(
        new Error("One or more menu items were not found."),
        { statusCode: 404 }
      );
    }

    const unavailable = menuItems.find(
      (item) => Number(item.is_available) !== 1
    );

    if (unavailable) {
      throw Object.assign(
        new Error(`Menu item "${unavailable.name}" is unavailable.`),
        { statusCode: 409 }
      );
    }

    // Load recipe ingredients.
    const [recipeRows] = await connection.query(
      `SELECT
         r.id AS recipe_id,
         r.menu_item_id,
         r.ingredient_id,
         r.quantity_required,
         r.yield_quantity,
         i.id AS existing_ingredient_id,
         i.name AS ingredient_name,
         i.unit AS ingredient_unit
       FROM recipes r
       LEFT JOIN ingredients i ON i.id = r.ingredient_id
       WHERE r.menu_item_id IN (${placeholders})
       ORDER BY r.ingredient_id, r.menu_item_id`,
      menuItemIds
    );

    const invalidRecipe = recipeRows.find(
      (recipe) =>
        recipe.existing_ingredient_id == null ||
        !Number.isFinite(Number(recipe.quantity_required)) ||
        Number(recipe.quantity_required) <= 0 ||
        !Number.isFinite(Number(recipe.yield_quantity)) ||
        Number(recipe.yield_quantity) <= 0
    );

    if (invalidRecipe) {
      throw Object.assign(
        new Error(
          "Cannot complete sale: a recipe has a missing ingredient or invalid quantity."
        ),
        { statusCode: 409 }
      );
    }

    // Group recipes by menu item.
    const recipesByMenuItem = new Map();

    for (const row of recipeRows) {
      const menuId = Number(row.menu_item_id);

      if (!recipesByMenuItem.has(menuId)) {
        recipesByMenuItem.set(menuId, []);
      }

      recipesByMenuItem.get(menuId).push(row);
    }

    // Require a recipe for every sold menu item.
    for (const menuId of menuItemIds) {
      if (
        !recipesByMenuItem.has(menuId) ||
        recipesByMenuItem.get(menuId).length === 0
      ) {
        const menu = menuItems.find(
          (item) => Number(item.id) === menuId
        );

        throw Object.assign(
          new Error(
            `Cannot sell "${menu?.name || menuId}": recipe/BOM is not configured.`
          ),
          { statusCode: 409 }
        );
      }
    }

    // Calculate required ingredient quantities.
    const requiredIngredients = new Map();

    for (const [menuId, quantity] of itemQuantities) {
      for (const recipe of recipesByMenuItem.get(menuId)) {
        const yieldQty = Number(recipe.yield_quantity);
        const perYield = Number(recipe.quantity_required);

        const required = (perYield / yieldQty) * quantity;
        const ingredientId = Number(recipe.ingredient_id);
        const existing = requiredIngredients.get(ingredientId);

        if (existing) {
          existing.required += required;
        } else {
          requiredIngredients.set(ingredientId, {
            ingredient_id: ingredientId,
            ingredient_name: recipe.ingredient_name,
            unit: recipe.ingredient_unit,
            required,
          });
        }
      }
    }

    // Lock ingredient stock.
    const ingredientIds = [
      ...requiredIngredients.keys(),
    ].sort((a, b) => a - b);

    const ingredientPlaceholders = ingredientIds
      .map(() => "?")
      .join(",");

    const [stockRows] = await connection.query(
      `SELECT id, name, unit, quantity
       FROM ingredients
       WHERE id IN (${ingredientPlaceholders})
       ORDER BY id
       FOR UPDATE`,
      ingredientIds
    );

    const stockById = new Map(
      stockRows.map((row) => [Number(row.id), row])
    );

    const insufficient = [];

    for (const item of requiredIngredients.values()) {
      const stock = stockById.get(item.ingredient_id);

      if (!stock) {
        throw Object.assign(
          new Error(
            `Ingredient "${item.ingredient_name}" was not found.`
          ),
          { statusCode: 409 }
        );
      }

      item.available = Number(stock.quantity);
      item.unit = stock.unit;

      if (
        !Number.isFinite(item.available) ||
        item.available < item.required - 0.000001
      ) {
        insufficient.push({
          ingredient_id: item.ingredient_id,
          name: item.ingredient_name,
          available: Number.isFinite(item.available)
            ? item.available
            : null,
          required: Number(item.required.toFixed(3)),
          unit: item.unit,
        });
      }
    }

    if (insufficient.length > 0) {
      throw Object.assign(
        new Error("Insufficient stock. No sale was created."),
        {
          statusCode: 409,
          ingredients: insufficient,
        }
      );
    }

    // Calculate prices using database values.
    const menuItemById = new Map(
      menuItems.map((item) => [Number(item.id), item])
    );

    const saleLines = menuItemIds.map((menuId) => {
      const menu = menuItemById.get(menuId);
      const quantity = itemQuantities.get(menuId);
      const unitPrice = Number(menu.selling_price);

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error(
          `Invalid selling price for ${menu.name}.`
        );
      }

      return {
        menu_item_id: menuId,
        quantity,
        unit_price: unitPrice,
        line_total: Number((unitPrice * quantity).toFixed(2)),
      };
    });

    const totalAmount = Number(
      saleLines
        .reduce((sum, line) => sum + line.line_total, 0)
        .toFixed(2)
    );

    // Create sale.
    const [saleResult] = await connection.query(
      `INSERT INTO sales
         (customer_id, total_amount, status)
       VALUES (?, ?, 'COMPLETED')`,
      [customerId, totalAmount]
    );

    const saleId = saleResult.insertId;

    // Save sale items.
    for (const line of saleLines) {
      await connection.query(
        `INSERT INTO sale_items
           (sale_id, menu_item_id, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [
          saleId,
          line.menu_item_id,
          line.quantity,
          line.unit_price,
          line.line_total,
        ]
      );
    }

    // Deduct stock and record movements.
    for (const item of requiredIngredients.values()) {
      const previousQuantity = Number(item.available);
      const consumedQuantity = Number(item.required);

      const newQuantity = Number(
        (previousQuantity - consumedQuantity).toFixed(3)
      );

      if (
        !Number.isFinite(previousQuantity) ||
        !Number.isFinite(consumedQuantity) ||
        !Number.isFinite(newQuantity) ||
        consumedQuantity <= 0 ||
        newQuantity < -0.000001
      ) {
        throw new Error(
          `Invalid stock calculation for ${item.ingredient_name}.`
        );
      }

      const [updateResult] = await connection.query(
        `UPDATE ingredients
         SET quantity = quantity - ?
         WHERE id = ? AND quantity >= ?`,
        [
          consumedQuantity,
          item.ingredient_id,
          consumedQuantity,
        ]
      );

      if (updateResult.affectedRows !== 1) {
        throw Object.assign(
          new Error(
            `Stock update failed for ${item.ingredient_name}.`
          ),
          { statusCode: 409 }
        );
      }

      const [movementResult] = await connection.query(
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
          item.ingredient_id,
          consumedQuantity,
          `Sale #${saleId}: automatic recipe consumption`,
          previousQuantity,
          newQuantity,
        ]
      );

      const [savedMovements] = await connection.query(
        `SELECT
           id,
           ingredient_id,
           previous_quantity,
           new_quantity,
           notes
         FROM stock_movements
         WHERE id = ?`,
        [movementResult.insertId]
      );

      const savedMovement = savedMovements[0];

      if (
        !savedMovement ||
        savedMovement.previous_quantity == null ||
        savedMovement.new_quantity == null
      ) {
        throw new Error(
          `Stock movement ${movementResult.insertId} was saved without balance values.`
        );
      }
    }

    // Save stock consumption history.
    for (const [menuId, quantity] of itemQuantities) {
      for (const recipe of recipesByMenuItem.get(menuId)) {
        const consumed =
          (Number(recipe.quantity_required) /
            Number(recipe.yield_quantity)) *
          quantity;

        await connection.query(
          `INSERT INTO stock_consumption
             (ingredient_id, menu_item_id, quantity, source, notes)
           VALUES (?, ?, ?, 'sale', ?)`,
          [
            Number(recipe.ingredient_id),
            menuId,
            consumed,
            `Sale #${saleId}: automatic recipe consumption`,
          ]
        );
      }
    }

    await connection.commit();
    transactionStarted = false;

    return res.status(201).json({
      message: "Sale completed and ingredient stock deducted.",
      sale_id: saleId,
      customer_id: customerId,
      total_amount: totalAmount,
      items: saleLines,
      deductions: [...requiredIngredients.values()].map(
        (item) => ({
          ingredient_id: item.ingredient_id,
          ingredient_name: item.ingredient_name,
          quantity_consumed: Number(item.required.toFixed(3)),
          unit: item.unit,
          previous_stock: Number(item.available.toFixed(3)),
          remaining_stock: Number(
            (item.available - item.required).toFixed(3)
          ),
        })
      ),
    });
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback().catch((rollbackError) => {
        console.error(
          "Sale rollback error:",
          rollbackError.message
        );
      });
    }

    console.error("Sales controller error:", error);

    return res.status(error.statusCode || 500).json({
      message: error.message || "Could not complete sale.",
      ...(error.ingredients
        ? { ingredients: error.ingredients }
        : {}),
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
