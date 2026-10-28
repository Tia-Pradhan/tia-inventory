
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import "./Reservations.css";

const EMPTY_FORM = {
  customer_id: "",
  guest_name: "",
  guest_phone: "",
  reservation_date: "",
  reservation_time: "19:00",
  party_size: 2,
  table_number: "",
  status: "PENDING",
  notes: "",
};

const STATUSES = [
  "PENDING",
  "CONFIRMED",
  "SEATED",
  "COMPLETED",
  "CANCELLED",
];

function todayString() {
  const date = new Date();
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );
  return localDate.toISOString().slice(0, 10);
}

function displayDate(value) {
  if (!value) return "—";

  const date = String(value).slice(0, 10);
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function displayTime(value) {
  return value ? String(value).slice(0, 5) : "—";
}

export default function Reservations() {
  const [reservations, setReservations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tableAvailability, setTableAvailability] = useState({
    state: "idle",
    message: "Select a date, time and table to check availability.",
  });

  const loadCustomers = useCallback(async () => {
    const response = await api.get("/customers");
    const data = response.data;

    setCustomers(Array.isArray(data) ? data : data.customers || []);
  }, []);

  const loadReservations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {};

      if (filterDate) params.date = filterDate;
      if (filterStatus) params.status = filterStatus;
      if (search.trim()) params.search = search.trim();

      const response = await api.get("/reservations", { params });
      const data = response.data;

      setReservations(
        Array.isArray(data) ? data : data.reservations || []
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load reservations. Check your backend."
      );
    } finally {
      setLoading(false);
    }
  }, [filterDate, filterStatus, search]);

  useEffect(() => {
    loadCustomers().catch((err) => {
      setError(
        err.response?.data?.message ||
          "Unable to load customers."
      );
    });
  }, [loadCustomers]);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  useEffect(() => {
    let cancelled = false;

    async function checkAvailability() {
      const table = form.table_number.trim();
      const date = form.reservation_date;
      const time = form.reservation_time;

      if (!table || !date || !time) {
        setTableAvailability({
          state: "idle",
          message: "Select a date, time and table to check availability.",
        });
        return;
      }

      setTableAvailability({
        state: "checking",
        message: "Checking table availability...",
      });

      try {
        const response = await api.get("/reservations", {
          params: { date },
        });

        const data = response.data;
        const dayReservations = Array.isArray(data)
          ? data
          : data.reservations || [];

        const toMinutes = (value) => {
          const [hours, minutes] = String(value || "00:00")
            .slice(0, 5)
            .split(":")
            .map(Number);

          return hours * 60 + minutes;
        };

        const start = toMinutes(time);
        const end = start + 120;

        const conflict = dayReservations.find((reservation) => {
          if (editingId !== null &&
              Number(reservation.id) === Number(editingId)) {
            return false;
          }

          if (
            String(reservation.table_number || "").trim().toLowerCase() !==
            table.toLowerCase()
          ) {
            return false;
          }

          if (
            !["PENDING", "CONFIRMED", "SEATED"].includes(
              reservation.status
            )
          ) {
            return false;
          }

          const existingStart = toMinutes(reservation.reservation_time);
          const existingEnd = existingStart + 120;

          return start < existingEnd && end > existingStart;
        });

        if (cancelled) return;

        setTableAvailability(
          conflict
            ? {
                state: "unavailable",
                message: `Table ${table} is unavailable. It conflicts with reservation #${conflict.id} for ${conflict.guest_name}.`,
              }
            : {
                state: "available",
                message: `Table ${table} appears available for this time.`,
              }
        );
      } catch {
        if (cancelled) return;

        setTableAvailability({
          state: "error",
          message: "Could not check availability. Please try again.",
        });
      }
    }

    checkAvailability();

    return () => {
      cancelled = true;
    };
  }, [
    form.table_number,
    form.reservation_date,
    form.reservation_time,
    editingId,
  ]);

  function changeField(event) {
    const { name, value } = event.target;

    if (name === "customer_id") {
      const selected = customers.find(
        (customer) => String(customer.id) === value
      );

      setForm((previous) => ({
        ...previous,
        customer_id: value,
        guest_name: selected
          ? selected.name
          : previous.guest_name,
        guest_phone: selected
          ? selected.phone || ""
          : previous.guest_phone,
      }));

      return;
    }

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setMessage("");
  }

  async function submitReservation(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        ...form,
        customer_id: form.customer_id
          ? Number(form.customer_id)
          : null,
        party_size: Number(form.party_size),
        guest_name: form.guest_name.trim(),
        guest_phone: form.guest_phone.trim() || null,
        table_number: form.table_number.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (editingId) {
        await api.put(`/reservations/${editingId}`, payload);
        setMessage("Reservation updated successfully.");
      } else {
        await api.post("/reservations", payload);
        setMessage("Reservation created successfully.");
      }

      resetForm();
      setMessage(
        editingId
          ? "Reservation updated successfully."
          : "Reservation created successfully."
      );

      await loadReservations();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save reservation."
      );
    } finally {
      setSaving(false);
    }
  }

  function editReservation(reservation) {
    setEditingId(reservation.id);

    setForm({
      customer_id: reservation.customer_id
        ? String(reservation.customer_id)
        : "",
      guest_name: reservation.guest_name || "",
      guest_phone: reservation.guest_phone || "",
      reservation_date: String(
        reservation.reservation_date || ""
      ).slice(0, 10),
      reservation_time: displayTime(
        reservation.reservation_time
      ),
      party_size: reservation.party_size || 2,
      table_number: reservation.table_number || "",
      status: reservation.status || "PENDING",
      notes: reservation.notes || "",
    });

    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function changeStatus(id, status) {
    setError("");
    setMessage("");

    try {
      await api.patch(`/reservations/${id}/status`, {
        status,
      });

      setMessage("Reservation status updated.");
      await loadReservations();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to update status."
      );
    }
  }

  async function deleteReservation(reservation) {
    if (
      !window.confirm(
        `Delete reservation for ${reservation.guest_name}?`
      )
    ) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await api.delete(`/reservations/${reservation.id}`);

      if (Number(editingId) === Number(reservation.id)) {
        resetForm();
      }

      setMessage("Reservation deleted.");
      await loadReservations();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to delete reservation."
      );
    }
  }

  const today = todayString();

  const todayCount = reservations.filter(
    (reservation) =>
      String(reservation.reservation_date).slice(0, 10) === today &&
      reservation.status !== "CANCELLED"
  ).length;

  const pendingCount = reservations.filter(
    (reservation) => reservation.status === "PENDING"
  ).length;

  const confirmedCount = reservations.filter(
    (reservation) => reservation.status === "CONFIRMED"
  ).length;

  return (
    <main className="reservations-page">
      <header className="reservations-header">
        <div>
          <h1>Reservation Management</h1>
          <p>Manage bookings, guests, tables and reservation status.</p>
        </div>

        <button
          type="button"
          className="reservation-secondary-button"
          onClick={() => {
            resetForm();
            setError("");
          }}
        >
          + New Reservation
        </button>
      </header>

      <section className="reservation-stats">
        <article className="reservation-stat">
          <span>Today's reservations</span>
          <strong>{todayCount}</strong>
        </article>

        <article className="reservation-stat">
          <span>Pending</span>
          <strong>{pendingCount}</strong>
        </article>

        <article className="reservation-stat">
          <span>Confirmed</span>
          <strong>{confirmedCount}</strong>
        </article>

        <article className="reservation-stat">
          <span>Total shown</span>
          <strong>{reservations.length}</strong>
        </article>
      </section>

      {error && (
        <div className="reservation-alert reservation-error">
          {error}
        </div>
      )}

      {message && (
        <div className="reservation-alert reservation-success">
          {message}
        </div>
      )}

      <section className="reservation-card">
        <h2>{editingId ? "Edit Reservation" : "Create Reservation"}</h2>

        <form
          className="reservation-form"
          onSubmit={submitReservation}
        >
          <label>
            Registered customer (optional)
            <select
              name="customer_id"
              value={form.customer_id}
              onChange={changeField}
            >
              <option value="">Walk-in / guest</option>

              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} {customer.phone ? `— ${customer.phone}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            Guest name *
            <input
              name="guest_name"
              value={form.guest_name}
              onChange={changeField}
              required
              maxLength={150}
              placeholder="Enter guest name"
            />
          </label>

          <label>
            Phone number
            <input
              name="guest_phone"
              value={form.guest_phone}
              onChange={changeField}
              maxLength={20}
              placeholder="Enter phone number"
            />
          </label>

          <label>
            Reservation date *
            <input
              type="date"
              name="reservation_date"
              value={form.reservation_date}
              onChange={changeField}
              min={today}
              required
            />
          </label>

          <label>
            Reservation time *
            <input
              type="time"
              name="reservation_time"
              value={form.reservation_time}
              onChange={changeField}
              required
            />
          </label>

          <label>
            Number of guests *
            <input
              type="number"
              name="party_size"
              min="1"
              max="100"
              value={form.party_size}
              onChange={changeField}
              required
            />
          </label>

          <label>
            Table number
            <input
              className="reservation-table-input"
              name="table_number"
              type="text"
              value={form.table_number}
              onChange={changeField}
              maxLength={30}
              placeholder="e.g. T1"
              autoComplete="off"
              aria-describedby="table-availability-message"
              style={{
                backgroundColor: "#ffffff",
                color: "#111827",
                opacity: 1,
                cursor: "text",
              }}
            />
          </label>

          <div
            id="table-availability-message"
            className={`table-availability table-availability-${tableAvailability.state}`}
            role="status"
            aria-live="polite"
          >
            {tableAvailability.message}
          </div>

          <label>
            Status
            <select
              name="status"
              value={form.status}
              onChange={changeField}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="reservation-full-width">
            Notes / special requests
            <textarea
              name="notes"
              value={form.notes}
              onChange={changeField}
              rows="3"
              placeholder="Birthday, dietary requests, etc."
            />
          </label>

          <div className="reservation-form-actions reservation-full-width">
            <button
              type="submit"
              disabled={saving}
              className="reservation-primary-button"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Save Changes"
                  : "Create Reservation"}
            </button>

            {editingId && (
              <button
                type="button"
                className="reservation-secondary-button"
                onClick={resetForm}
              >
                Cancel Editing
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="reservation-card">
        <div className="reservation-list-header">
          <h2>Reservations</h2>
          <button
            type="button"
            className="reservation-secondary-button"
            onClick={loadReservations}
          >
            Refresh
          </button>
        </div>

        <div className="reservation-filters">
          <input
            type="date"
            aria-label="Filter by date"
            value={filterDate}
            onChange={(event) => setFilterDate(event.target.value)}
          />

          <select
            aria-label="Filter by status"
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
          >
            <option value="">All statuses</option>

            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <input
            aria-label="Search reservations"
            placeholder="Search guest, customer or phone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {loading ? (
          <p>Loading reservations...</p>
        ) : reservations.length === 0 ? (
          <p className="reservation-empty">
            No reservations found. Create your first booking above.
          </p>
        ) : (
          <div className="reservation-table-wrapper">
            <table className="reservation-table">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Date & time</th>
                  <th>Guests</th>
                  <th>Table</th>
                  <th>Status</th>
                  <th>Change status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {reservations.map((reservation) => (
                  <tr key={reservation.id}>
                    <td>
                      <strong>{reservation.guest_name}</strong>
                      <small>{reservation.guest_phone || "No phone"}</small>
                      {reservation.customer_name && (
                        <small>
                          Customer: {reservation.customer_name}
                        </small>
                      )}
                    </td>

                    <td>
                      {displayDate(reservation.reservation_date)}
                      <small>
                        {displayTime(reservation.reservation_time)}
                      </small>
                    </td>

                    <td>{reservation.party_size}</td>
                    <td>{reservation.table_number || "—"}</td>

                    <td>
                      <span
                        className={`reservation-status status-${String(
                          reservation.status
                        ).toLowerCase()}`}
                      >
                        {reservation.status}
                      </span>
                    </td>

                    <td>
                      <select
                        aria-label={`Change status for ${reservation.guest_name}`}
                        value={reservation.status}
                        onChange={(event) =>
                          changeStatus(
                            reservation.id,
                            event.target.value
                          )
                        }
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <div className="reservation-row-actions">
                        <button
                          type="button"
                          onClick={() => editReservation(reservation)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="reservation-delete-button"
                          onClick={() => deleteReservation(reservation)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
