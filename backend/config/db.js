
const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "restaurant_pos",
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function testDatabaseConnection() {
  let connection;

  try {
    connection = await pool.getConnection();

    const [rows] = await connection.query(
      "SELECT DATABASE() AS db, VERSION() AS mysqlVersion"
    );

    console.log("MySQL connected successfully.");
    console.log("Backend database:", rows[0].db);
    console.log("MySQL version:", rows[0].mysqlVersion);

    if (rows[0].db !== "restaurant_pos") {
      console.warn(
        "WARNING: The backend is not connected to restaurant_pos. Check backend/.env."
      );
    }
  } catch (error) {
    console.error("MySQL connection failed:", error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  pool,
  testDatabaseConnection,
};
