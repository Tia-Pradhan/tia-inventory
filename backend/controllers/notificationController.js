
const { pool } = require("../config/db");

// Generate current notifications from the database.
async function buildNotifications() {
  const [ingredients] = await pool.query(`
    SELECT id, name, quantity, min_stock
    FROM ingredients
    WHERE quantity <= min_stock
    ORDER BY quantity ASC, name ASC
  `);

  const [reservations] = await pool.query(`
    SELECT
      id,
      guest_name,
      guest_phone,
      reservation_date,
      reservation_time,
      party_size,
      table_number,
      status
    FROM reservations
    WHERE reservation_date >= CURDATE()
      AND reservation_date < DATE_ADD(CURDATE(), INTERVAL 2 DAY)
      AND status IN ('PENDING', 'CONFIRMED')
    ORDER BY reservation_date ASC, reservation_time ASC
  `);

  const stockNotifications = ingredients.map((item) => {
    const quantity = Number(item.quantity);
    const minimum = Number(item.min_stock);
    const outOfStock = quantity <= 0;

    return {
      id: `${outOfStock ? "OUT_OF_STOCK" : "LOW_STOCK"}-${item.id}`,
      type: outOfStock ? "OUT_OF_STOCK" : "LOW_STOCK",
      title: outOfStock
        ? "Ingredient out of stock"
        : "Low stock warning",
      message:
        `${item.name}: ${quantity} remaining; ` +
        `minimum stock is ${minimum}.`,
      severity: outOfStock ? "critical" : "warning",
      link: "/stock",
    };
  });

  const reservationNotifications = reservations.map((item) => ({
    id: `RESERVATION-${item.id}`,
    type: "RESERVATION",
    title:
      item.status === "PENDING"
        ? "Reservation needs confirmation"
        : "Upcoming reservation",
    message:
      `${item.guest_name} — ${item.party_size} guest(s), ` +
      `${String(item.reservation_date).slice(0, 10)} at ` +
      `${String(item.reservation_time).slice(0, 5)}` +
      `${item.table_number ? `, table ${item.table_number}` : ""}.`,
    severity: item.status === "PENDING" ? "warning" : "info",
    status: item.status,
    link: "/reservations",
  }));

  const notifications = [
    ...stockNotifications,
    ...reservationNotifications,
  ];

  const severityOrder = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  notifications.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  return notifications;
}

// GET /api/notifications
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await buildNotifications();

    const [readRows] = await pool.query(
      "SELECT notification_key FROM notification_reads"
    );

    const readKeys = new Set(
      readRows.map((row) => row.notification_key)
    );

    const result = notifications.map((notification) => ({
      ...notification,
      is_read: readKeys.has(notification.id),
    }));

    return res.json({
      count: result.length,
      unread_count: result.filter((item) => !item.is_read).length,
      critical_count: result.filter(
        (item) => item.severity === "critical"
      ).length,
      notifications: result,
    });
  } catch (error) {
    console.error("Get notifications:", error);

    return res.status(500).json({
      message: "Failed to load notifications.",
    });
  }
};

// PATCH /api/notifications/:id/read
exports.markNotificationRead = async (req, res) => {
  try {
    const notificationId = req.params.id;
    const notifications = await buildNotifications();

    const notificationExists = notifications.some(
      (item) => item.id === notificationId
    );

    if (!notificationExists) {
      return res.status(404).json({
        message: "Notification not found or no longer active.",
      });
    }

    await pool.query(
      `INSERT IGNORE INTO notification_reads (notification_key)
       VALUES (?)`,
      [notificationId]
    );

    return res.json({
      message: "Notification marked as read.",
      id: notificationId,
      is_read: true,
    });
  } catch (error) {
    console.error("Mark notification read:", error);

    return res.status(500).json({
      message: "Failed to mark notification as read.",
    });
  }
};

// PATCH /api/notifications/read-all
exports.markAllNotificationsRead = async (req, res) => {
  try {
    const notifications = await buildNotifications();

    if (notifications.length > 0) {
      const values = notifications.map((item) => [item.id]);

      await pool.query(
        `INSERT IGNORE INTO notification_reads (notification_key)
         VALUES ?`,
        [values]
      );
    }

    return res.json({
      message: "All current notifications marked as read.",
      count: notifications.length,
    });
  } catch (error) {
    console.error("Mark all notifications read:", error);

    return res.status(500).json({
      message: "Failed to mark notifications as read.",
    });
  }
};
