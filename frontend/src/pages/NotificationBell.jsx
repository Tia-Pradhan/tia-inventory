
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  AlertTriangle,
  CalendarDays,
  Package,
  X,
  CheckCheck,
} from "lucide-react";
import api from "../services/api";
import "./NotificationBell.css";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  const loadNotifications = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.get("/notifications");
      setNotifications(response.data.notifications || []);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not load notifications."
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

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  async function markAsRead(notification) {
    if (notification.is_read) return;

    // Update the interface immediately.
    setNotifications((previous) =>
      previous.map((item) =>
        item.id === notification.id
          ? { ...item, is_read: true }
          : item
      )
    );

    try {
      await api.patch(
        `/notifications/${encodeURIComponent(notification.id)}/read`
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not mark notification as read."
      );

      // Restore the unread state if saving failed.
      setNotifications((previous) =>
        previous.map((item) =>
          item.id === notification.id
            ? { ...item, is_read: false }
            : item
        )
      );
    }
  }

  async function markAllAsRead() {
    if (unreadCount === 0 || markingAll) return;

    setMarkingAll(true);

    try {
      await api.patch("/notifications/read-all");

      setNotifications((previous) =>
        previous.map((item) => ({ ...item, is_read: true }))
      );

      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not mark all notifications as read."
      );
    } finally {
      setMarkingAll(false);
    }
  }

  async function openNotification(notification) {
    await markAsRead(notification);
    setOpen(false);
    navigate(notification.link || "/");
  }

  function getIcon(notification) {
    if (
      notification.type === "LOW_STOCK" ||
      notification.type === "OUT_OF_STOCK"
    ) {
      return <Package size={18} />;
    }

    if (notification.type === "RESERVATION") {
      return <CalendarDays size={18} />;
    }

    return <AlertTriangle size={18} />;
  }

  return (
    <div className="notification-bell-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className={`notification-bell-button ${
          open ? "is-open" : ""
        }`}
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={open}
        onClick={() => {
          const willOpen = !open;
          setOpen(willOpen);

          if (willOpen) loadNotifications();
        }}
      >
        <Bell size={23} />

        {unreadCount > 0 && (
          <span className="notification-bell-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          className="notification-dropdown"
          aria-label="Notifications"
        >
          <header className="notification-dropdown-header">
            <div>
              <h3>Notifications</h3>
              <p>
                {unreadCount === 0
                  ? "You're all caught up"
                  : `${unreadCount} unread alert${
                      unreadCount === 1 ? "" : "s"
                    }`}
              </p>
            </div>

            <button
              type="button"
              className="notification-close-button"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
            >
              <X size={19} />
            </button>
          </header>

          {notifications.length > 0 && (
            <div className="notification-actions">
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={unreadCount === 0 || markingAll}
              >
                <CheckCheck size={15} />
                {markingAll ? "Saving..." : "Mark all as read"}
              </button>
            </div>
          )}

          {error && (
            <div className="notification-inline-error">
              {error}
              <button
                type="button"
                onClick={loadNotifications}
              >
                Retry
              </button>
            </div>
          )}

          {loading && notifications.length === 0 ? (
            <div className="notification-dropdown-empty">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="notification-dropdown-empty">
              <Bell size={28} />
              <strong>No active alerts</strong>
              <span>
                No low-stock warnings or upcoming reservations found.
              </span>
            </div>
          ) : (
            <div className="notification-dropdown-list">
              {notifications.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  className={[
                    "notification-dropdown-item",
                    `severity-${notification.severity}`,
                    notification.is_read
                      ? "notification-read"
                      : "notification-unread",
                  ].join(" ")}
                  onClick={() => openNotification(notification)}
                >
                  <span className="notification-dropdown-icon">
                    {getIcon(notification)}
                  </span>

                  <span className="notification-dropdown-content">
                    <strong>{notification.title}</strong>
                    <span>{notification.message}</span>
                    <small>
                      {notification.is_read
                        ? "Read"
                        : notification.severity === "critical"
                          ? "Critical alert"
                          : notification.severity === "warning"
                            ? "Needs attention"
                            : "Information"}
                    </small>
                  </span>

                  {!notification.is_read && (
                    <span
                      className="notification-unread-dot"
                      aria-label="Unread"
                    />
                  )}
                </button>
              ))}
            </div>
          )}

          <footer className="notification-dropdown-footer">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/notifications");
              }}
            >
              View all notifications
            </button>
          </footer>
        </section>
      )}
    </div>
  );
}
