
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  History,
  Search,
  RefreshCw,
  Plus,
  Minus,
  Settings2,
} from "lucide-react";

import { getStockHistory } from "../services/inventoryApi";
import "../styles/stockHistory.css";

export default function StockHistory() {
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState("");
  const [operationFilter, setOperationFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getStockHistory();
      const data = Array.isArray(response)
        ? response
        : response?.data || [];

      setHistory(data);
    } catch (err) {
      console.error("Stock history error:", err);
      setError(
        err.response?.data?.message ||
        "Unable to load stock history. Check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const getOperation = (movement) =>
    String(
      movement.movement_type ||
      movement.movementType ||
      movement.type ||
      movement.operation ||
      ""
    ).toUpperCase();

  const getOperationLabel = (movement) => {
    const type = getOperation(movement);

    if (type === "IN" || type === "STOCK-IN") return "Stock In";
    if (type === "OUT" || type === "STOCK-OUT") return "Stock Out";
    if (type === "WASTAGE") return "Wastage";
    if (type === "ADJUSTMENT") return "Adjustment";

    return type || "-";
  };

  const getOperationClass = (movement) => {
    const type = getOperation(movement);

    if (type === "IN" || type === "STOCK-IN") return "stock-in";
    if (type === "OUT" || type === "STOCK-OUT") return "stock-out";

    return "adjustment";
  };

  const getOperationIcon = (movement) => {
    const type = getOperation(movement);

    if (type === "IN" || type === "STOCK-IN") {
      return <Plus size={15} />;
    }

    if (type === "OUT" || type === "STOCK-OUT") {
      return <Minus size={15} />;
    }

    return <Settings2 size={15} />;
  };

  const formatDate = (value) => {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const filteredHistory = useMemo(() => {
    return history.filter((movement) => {
      const operation = getOperation(movement);
      const productName = movement.productName || "";
      const sku = movement.sku || "";
      const reason = movement.notes || movement.reason || "";

      const searchText =
        `${productName} ${sku} ${reason}`.toLowerCase();

      const matchesSearch = searchText.includes(
        search.trim().toLowerCase()
      );

      let matchesOperation = operationFilter === "all";

      if (operationFilter === "stock-in") {
        matchesOperation = ["IN", "STOCK-IN"].includes(operation);
      } else if (operationFilter === "stock-out") {
        matchesOperation = ["OUT", "STOCK-OUT"].includes(operation);
      } else if (operationFilter === "adjustment") {
        matchesOperation = operation === "ADJUSTMENT";
      } else if (operationFilter === "wastage") {
        matchesOperation = operation === "WASTAGE";
      }

      return matchesSearch && matchesOperation;
    });
  }, [history, search, operationFilter]);

  return (
    <div className="page stock-history-page">
      <div className="page-header">
        <div>
          <h1>Stock History</h1>
          <p>Track all inventory movements and adjustments</p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={loadHistory}
          disabled={loading}
        >
          <RefreshCw
            size={17}
            className={loading ? "stock-history-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="stock-history-toolbar">
        <div className="stock-history-search">
          <Search size={19} />
          <input
            type="search"
            placeholder="Search product, SKU or reason..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <select
          className="stock-history-filter"
          value={operationFilter}
          onChange={(event) => setOperationFilter(event.target.value)}
        >
          <option value="all">All Operations</option>
          <option value="stock-in">Stock In</option>
          <option value="stock-out">Stock Out</option>
          <option value="adjustment">Adjustment</option>
          <option value="wastage">Wastage</option>
        </select>
      </div>

      {loading ? (
        <div className="stock-history-empty">
          <RefreshCw className="stock-history-spin" size={28} />
          <p>Loading stock history...</p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="stock-history-empty">
          <History size={42} />
          <h3>
            {search || operationFilter !== "all"
              ? "No matching movements"
              : "No stock history available"}
          </h3>
          <p>
            {search || operationFilter !== "all"
              ? "Try a different search or filter."
              : "Stock movements will appear here after inventory changes."}
          </p>
        </div>
      ) : (
        <div className="stock-history-table-wrap">
          <table className="stock-history-table">
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Product</th>
                <th>SKU</th>
                <th>Operation</th>
                <th>Previous Stock</th>
                <th>Quantity</th>
                <th>New Stock</th>
                <th>Reason</th>
              </tr>
            </thead>

            <tbody>
              {filteredHistory.map((movement) => (
                <tr key={movement.id}>
                  <td>{formatDate(movement.created_at || movement.createdAt)}</td>

                  <td>
                    <strong>{movement.productName || "-"}</strong>
                  </td>

                  <td>{movement.sku || "-"}</td>

                  <td>
                    <span
                      className={`stock-history-badge ${getOperationClass(movement)}`}
                    >
                      {getOperationIcon(movement)}
                      {getOperationLabel(movement)}
                    </span>
                  </td>

                  <td>
                    {movement.previousQuantity ?? "-"}
                  </td>

                  <td>
                    <strong>{Number(movement.quantity || 0)}</strong>
                  </td>

                  <td>{movement.newQuantity ?? "-"}</td>

                  <td>
                    {movement.notes || movement.reason || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
