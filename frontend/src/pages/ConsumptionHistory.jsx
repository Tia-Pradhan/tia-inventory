
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import "./ConsumptionHistory.css";

export default function ConsumptionHistory() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/consumption/history");
      const data = response.data;

      setRecords(Array.isArray(data) ? data : data.records || data.history || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not load consumption history. Check the backend."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="consumption-page">
      <div className="consumption-header">
        <div>
          <h1>Stock Consumption History</h1>
          <p>Track ingredients consumed during restaurant sales.</p>
        </div>

        <button
          className="consumption-refresh"
          onClick={loadHistory}
          disabled={loading}
        >
          {loading ? "Loading..." : "↻ Refresh"}
        </button>
      </div>

      <div className="consumption-summary">
        <span>Total movement records</span>
        <strong>{records.length}</strong>
      </div>

      {error && <div className="consumption-error">{error}</div>}

      <div className="consumption-table-wrapper">
        <table className="consumption-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Ingredient</th>
              <th>Movement</th>
              <th>Quantity</th>
              <th>Notes</th>
              <th>Date &amp; Time</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="consumption-empty">
                  Loading records...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan="6" className="consumption-empty">
                  Unable to display records.
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan="6" className="consumption-empty">
                  No stock movements found.
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record.id}>
                  <td>{record.id}</td>
                  <td>{record.ingredient_name || "—"}</td>
                  <td>
                    <span
                      className={`movement-badge ${
                        String(record.movement_type).toUpperCase() === "OUT"
                          ? "movement-out"
                          : "movement-in"
                      }`}
                    >
                      {record.movement_type || "—"}
                    </span>
                  </td>
                  <td>
                    {record.quantity ?? "—"}{" "}
                    {record.ingredient_unit || ""}
                  </td>
                  <td>{record.notes || "—"}</td>
                  <td>
                    {record.created_at
                      ? new Date(record.created_at).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
