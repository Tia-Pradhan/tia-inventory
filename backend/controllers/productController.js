
const { pool } = require("../config/db");

// GET all products
const getProducts = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        p.id,
        p.name,
        p.sku,
        p.price,
        p.quantity,
        p.category_id,
        p.min_stock,
        p.created_at,
        c.name AS categoryName
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.id DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Get products error:", error);

    res.status(500).json({
      message: "Failed to fetch products",
      error: error.message,
    });
  }
};

// GET product by ID
const getProduct = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         p.id,
         p.name,
         p.sku,
         p.price,
         p.quantity,
         p.category_id,
         p.min_stock,
         p.created_at,
         c.name AS categoryName
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Get product error:", error);

    res.status(500).json({
      message: "Failed to fetch product",
      error: error.message,
    });
  }
};

// CREATE product
const createProduct = async (req, res) => {
  try {
    const {
      name,
      sku,
      price = 0,
      quantity = 0,
      category_id = null,
      min_stock = 5,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Product name is required",
      });
    }

    const [result] = await pool.query(
      `INSERT INTO products
         (name, sku, price, quantity, category_id, min_stock)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        sku || null,
        Number(price),
        Number(quantity),
        category_id || null,
        Number(min_stock),
      ]
    );

    res.status(201).json({
      message: "Product created successfully",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Create product error:", error);

    res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({
      message:
        error.code === "ER_DUP_ENTRY"
          ? "This SKU already exists"
          : "Failed to create product",
      error: error.message,
    });
  }
};

// UPDATE product
const updateProduct = async (req, res) => {
  try {
    const {
      name,
      sku,
      price,
      quantity,
      category_id,
      min_stock,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Product name is required",
      });
    }

    const [result] = await pool.query(
      `UPDATE products
       SET name = ?,
           sku = ?,
           price = ?,
           quantity = ?,
           category_id = ?,
           min_stock = ?
       WHERE id = ?`,
      [
        name.trim(),
        sku || null,
        Number(price ?? 0),
        Number(quantity ?? 0),
        category_id || null,
        Number(min_stock ?? 5),
        req.params.id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Product not found or no changes made",
      });
    }

    res.json({
      message: "Product updated successfully",
    });
  } catch (error) {
    console.error("Update product error:", error);

    res.status(500).json({
      message: "Failed to update product",
      error: error.message,
    });
  }
};

// DELETE product
const deleteProduct = async (req, res) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM products WHERE id = ?",
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    res.json({
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);

    res.status(500).json({
      message: "Failed to delete product",
      error: error.message,
    });
  }
};

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
};
