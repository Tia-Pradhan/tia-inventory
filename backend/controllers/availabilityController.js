
const { pool } = require("../config/db");

// GET /api/availability
exports.getMenuAvailability = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        m.id,
        m.name,
        m.selling_price,
        m.is_available,
        r.id AS recipe_id,
        r.ingredient_id,
        r.quantity_required,
        r.yield_quantity,
        r.yield_unit,
        i.name AS ingredient_name,
        i.unit AS ingredient_unit,
        i.quantity AS available_stock
      FROM menu_items m
      LEFT JOIN recipes r
        ON r.menu_item_id = m.id
      LEFT JOIN ingredients i
        ON i.id = r.ingredient_id
      ORDER BY m.id, r.id
    `);

    const items = new Map();

    for (const row of rows) {
      if (!items.has(row.id)) {
        items.set(row.id, {
          id: row.id,
          name: row.name,
          selling_price: Number(row.selling_price),
          manually_available: Boolean(row.is_available),
          has_recipe: false,
          available: false,
          status: "unavailable",
          ingredients: [],
          reasons: [],
        });
      }

      const item = items.get(row.id);

      if (row.recipe_id == null || row.ingredient_id == null) {
        continue;
      }

      item.has_recipe = true;

      const yieldQuantity = Number(row.yield_quantity);
      const required = Number(row.quantity_required);
      const stock = Number(row.available_stock);

      const requiredPerServing =
        Number.isFinite(yieldQuantity) && yieldQuantity > 0
          ? required / yieldQuantity
          : NaN;

      const sufficient =
        Number.isFinite(requiredPerServing) &&
        requiredPerServing > 0 &&
        Number.isFinite(stock) &&
        stock >= requiredPerServing;

      item.ingredients.push({
        ingredient_id: row.ingredient_id,
        ingredient_name: row.ingredient_name,
        unit: row.ingredient_unit,
        available_stock: stock,
        required_stock: requiredPerServing,
        sufficient,
      });

      if (!sufficient) {
        item.reasons.push(
          `Insufficient or invalid stock: ${
            row.ingredient_name || "ingredient"
          }`
        );
      }
    }

    const result = [...items.values()].map((item) => {
      if (!item.manually_available) {
        item.reasons.push("Menu item manually disabled");
      }

      if (!item.has_recipe || item.ingredients.length === 0) {
        item.reasons.push("Recipe/BOM not configured");
      }

      item.available =
        item.manually_available &&
        item.has_recipe &&
        item.ingredients.length > 0 &&
        item.ingredients.every((ingredient) => ingredient.sufficient);

      item.status = item.available ? "available" : "unavailable";

      return item;
    });

    res.json(result);
  } catch (error) {
    console.error("Availability error:", error);

    res.status(500).json({
      message: "Failed to check menu availability",
      error: error.message,
    });
  }
};
