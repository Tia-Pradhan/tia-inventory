
const { pool } = require("../config/db");

const validDate = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

exports.getAnalytics = async (req, res) => {
  try {
    const { from, to } = req.query;

    if (
      (from && !validDate(from)) ||
      (to && !validDate(to)) ||
      (from && to && from > to)
    ) {
      return res.status(400).json({
        message: "Please provide a valid date range.",
      });
    }

    const dateParams = [];
    let salesDateFilter = "";
    let wastageDateFilter = "";

    if (from) {
      salesDateFilter += " AND DATE(s.created_at) >= ?";
      wastageDateFilter += " AND DATE(w.created_at) >= ?";
      dateParams.push(from);
    }

    if (to) {
      salesDateFilter += " AND DATE(s.created_at) <= ?";
      wastageDateFilter += " AND DATE(w.created_at) <= ?";
    }

    const salesParams = [];
    if (from) salesParams.push(from);
    if (to) salesParams.push(to);

    const wastageParams = [];
    if (from) wastageParams.push(from);
    if (to) wastageParams.push(to);

    const [
      [salesSummary],
      [dailySales],
      [topItems],
      [wastageSummary],
      [wastageReasons],
      [wastageIngredients],
      [inventorySummary],
      [lowStockItems],
      [productSummary],
    ] = await Promise.all([
      pool.query(
        `SELECT
           COALESCE(SUM(s.total_amount), 0) AS total_sales,
           COUNT(*) AS total_bills,
           COALESCE(AVG(s.total_amount), 0) AS average_bill
         FROM sales s
         WHERE UPPER(COALESCE(s.status, '')) <> 'CANCELLED'
         ${salesDateFilter}`,
        salesParams
      ),

      pool.query(
        `SELECT
           DATE(s.created_at) AS sale_date,
           COALESCE(SUM(s.total_amount), 0) AS revenue,
           COUNT(*) AS bills
         FROM sales s
         WHERE UPPER(COALESCE(s.status, '')) <> 'CANCELLED'
         ${salesDateFilter}
         GROUP BY DATE(s.created_at)
         ORDER BY sale_date ASC`,
        salesParams
      ),

      pool.query(
        `SELECT
           m.id AS menu_item_id,
           m.name AS menu_item_name,
           COALESCE(SUM(si.quantity), 0) AS quantity_sold,
           COALESCE(SUM(si.line_total), 0) AS revenue
         FROM sale_items si
         INNER JOIN sales s ON s.id = si.sale_id
         INNER JOIN menu_items m ON m.id = si.menu_item_id
         WHERE UPPER(COALESCE(s.status, '')) <> 'CANCELLED'
         ${salesDateFilter}
         GROUP BY m.id, m.name
         ORDER BY quantity_sold DESC, revenue DESC
         LIMIT 10`,
        salesParams
      ),

      pool.query(
        `SELECT
           COUNT(*) AS total_records,
           COALESCE(SUM(w.quantity), 0) AS total_quantity_wasted
         FROM wastage_records w
         WHERE 1 = 1 ${wastageDateFilter}`,
        wastageParams
      ),

      pool.query(
        `SELECT
           w.reason,
           COUNT(*) AS records,
           COALESCE(SUM(w.quantity), 0) AS quantity_wasted
         FROM wastage_records w
         WHERE 1 = 1 ${wastageDateFilter}
         GROUP BY w.reason
         ORDER BY quantity_wasted DESC`,
        wastageParams
      ),

      pool.query(
        `SELECT
           i.name AS ingredient_name,
           i.unit,
           COALESCE(SUM(w.quantity), 0) AS quantity_wasted
         FROM wastage_records w
         INNER JOIN ingredients i ON i.id = w.ingredient_id
         WHERE 1 = 1 ${wastageDateFilter}
         GROUP BY i.id, i.name, i.unit
         ORDER BY quantity_wasted DESC
         LIMIT 10`,
        wastageParams
      ),

      pool.query(
        `SELECT
           COUNT(*) AS total_ingredients,
           COALESCE(SUM(quantity), 0) AS total_stock,
           COALESCE(SUM(quantity * cost_per_unit), 0) AS stock_value,
           SUM(
             CASE WHEN quantity > 0 AND quantity <= min_stock
               THEN 1 ELSE 0 END
           ) AS low_stock,
           SUM(
             CASE WHEN quantity <= 0 THEN 1 ELSE 0 END
           ) AS out_of_stock
         FROM ingredients`
      ),

      pool.query(
        `SELECT id, name, quantity, min_stock, unit
         FROM ingredients
         WHERE quantity <= min_stock
         ORDER BY quantity ASC, name ASC
         LIMIT 10`
      ),

      pool.query(
        `SELECT COUNT(*) AS total_products FROM products`
      ),
    ]);

    return res.json({
      filters: { from: from || null, to: to || null },
      sales: {
        total_sales: Number(salesSummary.total_sales || 0),
        total_bills: Number(salesSummary.total_bills || 0),
        average_bill: Number(salesSummary.average_bill || 0),
        daily: dailySales.map((row) => ({
          date: String(row.sale_date).slice(0, 10),
          revenue: Number(row.revenue || 0),
          bills: Number(row.bills || 0),
        })),
        top_items: topItems.map((row) => ({
          ...row,
          quantity_sold: Number(row.quantity_sold || 0),
          revenue: Number(row.revenue || 0),
        })),
      },
      wastage: {
        total_records: Number(wastageSummary.total_records || 0),
        total_quantity: Number(
          wastageSummary.total_quantity_wasted || 0
        ),
        by_reason: wastageReasons.map((row) => ({
          ...row,
          records: Number(row.records || 0),
          quantity_wasted: Number(row.quantity_wasted || 0),
        })),
        by_ingredient: wastageIngredients.map((row) => ({
          ...row,
          quantity_wasted: Number(row.quantity_wasted || 0),
        })),
      },
      inventory: {
        total_ingredients: Number(
          inventorySummary.total_ingredients || 0
        ),
        total_stock: Number(inventorySummary.total_stock || 0),
        stock_value: Number(inventorySummary.stock_value || 0),
        low_stock: Number(inventorySummary.low_stock || 0),
        out_of_stock: Number(inventorySummary.out_of_stock || 0),
        low_stock_items: lowStockItems,
      },
      products: {
        total_products: Number(productSummary.total_products || 0),
      },
    });
  } catch (error) {
    console.error("Analytics API error:", error);
    return res.status(500).json({
      message: "Failed to load analytics.",
    });
  }
};
