const { pool } = require("../config/db");

// GET /api/customers
exports.getCustomers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, phone, address, created_at
       FROM customers
       ORDER BY id DESC`
    );

    res.json(rows);
  } catch (error) {
    console.error("Fetch customers error:", error);
    res.status(500).json({
      message: "Failed to fetch customers",
      error: error.message,
    });
  }
};

// POST /api/customers
exports.addCustomer = async (req, res) => {
  try {
    const { name, phone, address = "" } = req.body;

    if (!name?.trim() || !phone?.trim()) {
      return res.status(400).json({
        message: "Customer name and phone are required",
      });
    }

    const [result] = await pool.query(
      `INSERT INTO customers (name, phone, address)
       VALUES (?, ?, ?)`,
      [name.trim(), phone.trim(), address.trim()]
    );

    const [rows] = await pool.query(
      `SELECT id, name, phone, address, created_at
       FROM customers WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: "Customer added successfully",
      customer: rows[0],
    });
  } catch (error) {
    console.error("Add customer error:", error);

    res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({
      message:
        error.code === "ER_DUP_ENTRY"
          ? "This phone number already exists"
          : "Failed to add customer",
      error: error.message,
    });
  }
};

// DELETE /api/customers/:id
exports.deleteCustomer = async (req, res) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM customers WHERE id = ?",
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    console.error("Delete customer error:", error);
    res.status(500).json({
      message: "Failed to delete customer",
      error: error.message,
    });
  }
};