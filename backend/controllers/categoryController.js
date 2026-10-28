
const { pool } = require("../config/db");

async function getCategories(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, COUNT(p.id) AS productCount
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
}

async function getCategory(req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM categories WHERE id = ?",
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Category not found" });
    }
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch category" });
  }
}

async function createCategory(req, res) {
  const { name, description = "" } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ message: "Category name is required" });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO categories (name, description) VALUES (?, ?)",
      [name.trim(), description]
    );
    res.status(201).json({ id: result.insertId, message: "Category created" });
  } catch (e) {
    console.error(e);
    res.status(e.code === "ER_DUP_ENTRY" ? 409 : 500).json({
      message: e.code === "ER_DUP_ENTRY"
        ? "Category already exists"
        : "Failed to create category"
    });
  }
}

async function updateCategory(req, res) {
  const { name, description = "" } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ message: "Category name is required" });
  }

  try {
    const [result] = await pool.query(
      "UPDATE categories SET name = ?, description = ? WHERE id = ?",
      [name.trim(), description, req.params.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ message: "Category not found" });
    }
    res.json({ message: "Category updated" });
  } catch (e) {
    console.error(e);
    res.status(e.code === "ER_DUP_ENTRY" ? 409 : 500).json({
      message: e.code === "ER_DUP_ENTRY"
        ? "Category name already exists"
        : "Failed to update category"
    });
  }
}

async function deleteCategory(req, res) {
  try {
    const [result] = await pool.query(
      "DELETE FROM categories WHERE id = ?",
      [req.params.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ message: "Category not found" });
    }
    res.json({ message: "Category deleted" });
  } catch (e) {
    console.error(e);
    res.status(409).json({
      message: "Cannot delete a category that still has products"
    });
  }
}

module.exports = {
  getCategories, getCategory, createCategory, updateCategory, deleteCategory
};
