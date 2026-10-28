
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "./Notification.css";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const loadNotifications = useCallback(async () => {
    try {
      const response = await api.get("/notifications");

      setNotifications(response.data.notifications || []);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load notifications. Check your backend."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();

    const interval = setInterval(loadNotifications, 30000);

    return () => clearInterval(interval);
  }, [loadNotifications]);

  const criticalCount = notifications.filter(
    (item) => item.severity === "critical"
  ).length;

  const warningCount = notifications.filter(
    (item) => item.severity === "warning"
  ).length;

  function openNotification(notification) {
    navigate(notification.link || "/");
  }

  return (
    <main className="notifications-page">
      <header className="notifications-header">
        <div>
          <h1>Notifications</h1>
          <p>Stock alerts and upcoming restaurant reservations.</p>
        </div>

        <button
          type="button"
          className="notifications-refresh"
          onClick={loadNotifications}
        >
          ↻ Refresh
        </button>
      </header>

      <section className="notifications-summary">
        <article className="notification-stat">
          <span>Total alerts</span>
          <strong>{notifications.length}</strong>
        </article>

        <article className="notification-stat">
          <span>Critical</span>
          <strong>{criticalCount}</strong>
        </article>

        <article className="notification-stat">
          <span>Needs attention</span>
          <strong>{warningCount}</strong>
        </article>
      </section>

      {error && (
        <div className="notification-message notification-error">
          {error}
        </div>
      )}

      <section className="notifications-card">
        <div className="notifications-card-header">
          <h2>Recent alerts</h2>
          <span>{notifications.length} alerts</span>
        </div>

        {loading ? (
          <p className="notifications-empty">Loading notifications...</p>
        ) : notifications.length === 0 && !error ? (
          <div className="notifications-empty">
            <span className="notifications-empty-icon">✓</span>
            <h3>All clear!</h3>
            <p>
              No low-stock ingredients or upcoming reservations requiring
              attention were found.
            </p>
          </div>
        ) : (
          <div className="notifications-list">
            {notifications.map((notification) => (
              <article
                className={`notification-item severity-${notification.severity}`}
                key={notification.id}
              >
                <div className="notification-icon">
                  {notification.type === "OUT_OF_STOCK"
                    ? "🚨"
                    : notification.type === "LOW_STOCK"
                      ? "📦"
                      : "📅"}
                </div>

                <div className="notification-content">
                  <div className="notification-title-row">
                    <h3>{notification.title}</h3>

                    <span
                      className={`notification-badge badge-${notification.severity}`}
                    >
                      {notification.severity === "critical"
                        ? "Critical"
                        : notification.severity === "warning"
                          ? "Attention"
                          : "Information"}
                    </span>
                  </div>

                  <p>{notification.message}</p>

                  <button
                    type="button"
                    className="notification-open"
                    onClick={() => openNotification(notification)}
                  >
                    View details →
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="notifications-footnote">
        Alerts are generated from current database records. This page refreshes
        automatically every 30 seconds while it is open.
      </p>
    </main>
  );
}
