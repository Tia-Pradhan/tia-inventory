
const { pool } = require("../config/db");

const VALID_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "SEATED",
  "COMPLETED",
  "CANCELLED",
];

const BLOCKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "SEATED",
];

const RESERVATION_DURATION_MINUTES = 120;

// Validate reservation form data.
function validateReservation(body) {
  const {
    customer_id,
    guest_name,
    guest_phone,
    reservation_date,
    reservation_time,
    party_size,
    table_number,
    status,
    notes,
  } = body;

  const customerId =
    customer_id === "" || customer_id == null
      ? null
      : Number(customer_id);

  const guests = Number(party_size);

  if (
    customerId !== null &&
    (!Number.isInteger(customerId) || customerId <= 0)
  ) {
    return { error: "Invalid customer selected." };
  }

  if (!String(guest_name || "").trim()) {
    return { error: "Guest name is required." };
  }

  if (
    !reservation_date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(reservation_date)
  ) {
    return {
      error: "Valid reservation date is required (YYYY-MM-DD).",
    };
  }

  const date = new Date(`${reservation_date}T00:00:00Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== reservation_date
  ) {
    return { error: "Invalid reservation date." };
  }

  if (
    !reservation_time ||
    !/^\d{2}:\d{2}(:\d{2})?$/.test(reservation_time)
  ) {
    return { error: "Valid reservation time is required." };
  }

  const [hours, minutes, seconds = "00"] =
    reservation_time.split(":").map(Number);

  if (hours > 23 || minutes > 59 || seconds > 59) {
    return { error: "Invalid reservation time." };
  }

  if (!Number.isInteger(guests) || guests < 1 || guests > 100) {
    return {
      error: "Party size must be between 1 and 100.",
    };
  }

  if (status && !VALID_STATUSES.includes(status)) {
    return { error: "Invalid reservation status." };
  }

  return {
    values: {
      customer_id: customerId,
      guest_name: String(guest_name).trim(),
      guest_phone: guest_phone
        ? String(guest_phone).trim()
        : null,
      reservation_date,
      reservation_time:
        reservation_time.length === 5
          ? `${reservation_time}:00`
          : reservation_time,
      party_size: guests,
      table_number: table_number
        ? String(table_number).trim()
        : null,
      status: status || "PENDING",
      notes: notes ? String(notes).trim() : null,
    },
  };
}

// Check whether a table is already booked during the two-hour window.
async function checkTableConflict(
  connection,
  {
    table_number,
    reservation_date,
    reservation_time,
    status = "PENDING",
    excludeId = null,
  }
) {
  if (
    !table_number ||
    !BLOCKING_STATUSES.includes(status)
  ) {
    return null;
  }

  let sql = `
    SELECT id, guest_name, reservation_time
    FROM reservations
    WHERE table_number = ?
      AND reservation_date = ?
      AND status IN ('PENDING', 'CONFIRMED', 'SEATED')
      AND TIME_TO_SEC(reservation_time) <
          TIME_TO_SEC(?) + ?
      AND TIME_TO_SEC(reservation_time) + ? >
          TIME_TO_SEC(?)
  `;

  const durationSeconds =
    RESERVATION_DURATION_MINUTES * 60;

  const params = [
    table_number,
    reservation_date,
    reservation_time,
    durationSeconds,
    durationSeconds,
    reservation_time,
  ];

  if (excludeId !== null) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }

  sql += " ORDER BY reservation_time LIMIT 1";

  const [rows] = await connection.query(sql, params);

  return rows.length ? rows[0] : null;
}

// GET /api/reservations
// Optional filters: ?date=YYYY-MM-DD&status=CONFIRMED&search=John
exports.getReservations = async (req, res) => {
  try {
    const { date, status, search } = req.query;

    let sql = `
      SELECT
        r.id,
        r.customer_id,
        r.guest_name,
        r.guest_phone,
        r.reservation_date,
        r.reservation_time,
        r.party_size,
        r.table_number,
        r.status,
        r.notes,
        r.created_at,
        c.name AS customer_name
      FROM reservations r
      LEFT JOIN customers c ON c.id = r.customer_id
      WHERE 1 = 1
    `;

    const params = [];

    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          message: "Invalid date filter.",
        });
      }

      sql += " AND r.reservation_date = ?";
      params.push(date);
    }

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          message: "Invalid reservation status filter.",
        });
      }

      sql += " AND r.status = ?";
      params.push(status);
    }

    if (search && String(search).trim()) {
      sql += ` AND (
        r.guest_name LIKE ?
        OR r.guest_phone LIKE ?
        OR c.name LIKE ?
      )`;

      const term = `%${String(search).trim()}%`;
      params.push(term, term, term);
    }

    sql += `
      ORDER BY r.reservation_date DESC,
               r.reservation_time DESC,
               r.id DESC
    `;

    const [rows] = await pool.query(sql, params);

    return res.json(rows);
  } catch (error) {
    console.error("Get reservations:", error);

    return res.status(500).json({
      message: "Failed to fetch reservations.",
    });
  }
};

// GET /api/reservations/:id
exports.getReservationById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         r.*,
         c.name AS customer_name
       FROM reservations r
       LEFT JOIN customers c ON c.id = r.customer_id
       WHERE r.id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Reservation not found.",
      });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error("Get reservation:", error);

    return res.status(500).json({
      message: "Failed to fetch reservation.",
    });
  }
};

// POST /api/reservations
exports.createReservation = async (req, res) => {
  const result = validateReservation(req.body);

  if (result.error) {
    return res.status(400).json({
      message: result.error,
    });
  }

  const v = result.values;

  let connection;
  let transactionStarted = false;

  try {
    connection = await pool.getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    if (v.customer_id !== null) {
      const [customers] = await connection.query(
        `SELECT id, name, phone
         FROM customers
         WHERE id = ?
         FOR UPDATE`,
        [v.customer_id]
      );

      if (!customers.length) {
        await connection.rollback();
        transactionStarted = false;

        return res.status(404).json({
          message: "Selected customer was not found.",
        });
      }

      if (!v.guest_phone) {
        v.guest_phone = customers[0].phone || null;
      }
    }

    const conflict = await checkTableConflict(connection, {
      table_number: v.table_number,
      reservation_date: v.reservation_date,
      reservation_time: v.reservation_time,
      status: v.status,
    });

    if (conflict) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(409).json({
        message:
          `Table ${v.table_number} is unavailable for this time. ` +
          `It conflicts with reservation #${conflict.id} ` +
          `for ${conflict.guest_name}.`,
      });
    }

    const [insertResult] = await connection.query(
      `INSERT INTO reservations (
        customer_id,
        guest_name,
        guest_phone,
        reservation_date,
        reservation_time,
        party_size,
        table_number,
        status,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        v.customer_id,
        v.guest_name,
        v.guest_phone,
        v.reservation_date,
        v.reservation_time,
        v.party_size,
        v.table_number,
        v.status,
        v.notes,
      ]
    );

    await connection.commit();
    transactionStarted = false;

    return res.status(201).json({
      message: "Reservation created successfully.",
      id: insertResult.insertId,
    });
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback().catch(() => {});
    }

    console.error("Create reservation:", error);

    return res.status(500).json({
      message: "Failed to create reservation.",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PUT /api/reservations/:id
exports.updateReservation = async (req, res) => {
  const result = validateReservation(req.body);

  if (result.error) {
    return res.status(400).json({
      message: result.error,
    });
  }

  const v = result.values;
  const reservationId = Number(req.params.id);

  if (
    !Number.isInteger(reservationId) ||
    reservationId <= 0
  ) {
    return res.status(400).json({
      message: "Invalid reservation ID.",
    });
  }

  let connection;
  let transactionStarted = false;

  try {
    connection = await pool.getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    const [existing] = await connection.query(
      `SELECT id
       FROM reservations
       WHERE id = ?
       FOR UPDATE`,
      [reservationId]
    );

    if (!existing.length) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        message: "Reservation not found.",
      });
    }

    if (v.customer_id !== null) {
      const [customers] = await connection.query(
        "SELECT id FROM customers WHERE id = ?",
        [v.customer_id]
      );

      if (!customers.length) {
        await connection.rollback();
        transactionStarted = false;

        return res.status(404).json({
          message: "Selected customer was not found.",
        });
      }
    }

    const conflict = await checkTableConflict(connection, {
      table_number: v.table_number,
      reservation_date: v.reservation_date,
      reservation_time: v.reservation_time,
      status: v.status,
      excludeId: reservationId,
    });

    if (conflict) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(409).json({
        message:
          `Table ${v.table_number} is unavailable for this time. ` +
          `It conflicts with reservation #${conflict.id} ` +
          `for ${conflict.guest_name}.`,
      });
    }

    await connection.query(
      `UPDATE reservations
       SET customer_id = ?,
           guest_name = ?,
           guest_phone = ?,
           reservation_date = ?,
           reservation_time = ?,
           party_size = ?,
           table_number = ?,
           status = ?,
           notes = ?
       WHERE id = ?`,
      [
        v.customer_id,
        v.guest_name,
        v.guest_phone,
        v.reservation_date,
        v.reservation_time,
        v.party_size,
        v.table_number,
        v.status,
        v.notes,
        reservationId,
      ]
    );

    await connection.commit();
    transactionStarted = false;

    return res.json({
      message: "Reservation updated successfully.",
    });
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback().catch(() => {});
    }

    console.error("Update reservation:", error);

    return res.status(500).json({
      message: "Failed to update reservation.",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PATCH /api/reservations/:id/status
exports.updateReservationStatus = async (req, res) => {
  const { status } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      message: "Invalid reservation status.",
    });
  }

  const reservationId = Number(req.params.id);

  if (
    !Number.isInteger(reservationId) ||
    reservationId <= 0
  ) {
    return res.status(400).json({
      message: "Invalid reservation ID.",
    });
  }

  let connection;
  let transactionStarted = false;

  try {
    connection = await pool.getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    const [existing] = await connection.query(
      `SELECT
         table_number,
         reservation_date,
         reservation_time
       FROM reservations
       WHERE id = ?
       FOR UPDATE`,
      [reservationId]
    );

    if (!existing.length) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        message: "Reservation not found.",
      });
    }

    const reservation = existing[0];

    // Recheck availability when moving a booking into a blocking status.
    const conflict = await checkTableConflict(connection, {
      table_number: reservation.table_number,
      reservation_date: String(
        reservation.reservation_date
      ).slice(0, 10),
      reservation_time: String(
        reservation.reservation_time
      ).slice(0, 8),
      status,
      excludeId: reservationId,
    });

    if (conflict) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(409).json({
        message:
          `Cannot set this reservation to ${status}. ` +
          `The table conflicts with reservation #${conflict.id} ` +
          `for ${conflict.guest_name}.`,
      });
    }

    await connection.query(
      "UPDATE reservations SET status = ? WHERE id = ?",
      [status, reservationId]
    );

    await connection.commit();
    transactionStarted = false;

    return res.json({
      message: "Reservation status updated successfully.",
    });
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback().catch(() => {});
    }

    console.error("Update reservation status:", error);

    return res.status(500).json({
      message: "Failed to update reservation status.",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// DELETE /api/reservations/:id
exports.deleteReservation = async (req, res) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM reservations WHERE id = ?",
      [req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Reservation not found.",
      });
    }

    return res.json({
      message: "Reservation deleted successfully.",
    });
  } catch (error) {
    console.error("Delete reservation:", error);

    return res.status(500).json({
      message: "Failed to delete reservation.",
    });
  }
};
