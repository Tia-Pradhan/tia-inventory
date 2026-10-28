
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  IndianRupee,
  ReceiptText,
  Package,
  AlertTriangle,
  XCircle,
  Recycle,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import "../styles/analytics.css";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/$/, "");

const dateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const today = dateString(new Date());
const monthAgo = new Date();
monthAgo.setDate(monthAgo.getDate() - 29);

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const number = (value) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 3,
  }).format(Number(value || 0));

function MetricCard({ title, value, icon: Icon, tone, subtitle }) {
  return (
    <article className="analytics-metric">
      <div className={`analytics-metric-icon ${tone}`}>
        <Icon size={23} />
      </div>
      <div className="analytics-metric-copy">
        <span>{title}</span>
        <strong>{value}</strong>
        {subtitle && <small>{subtitle}</small>}
      </div>
    </article>
  );
}

function BarList({ items, labelKey, valueKey, format = number }) {
  if (!items?.length) {
    return <p className="analytics-empty">No data for this period.</p>;
  }

  const max = Math.max(
    ...items.map((item) => Number(item[valueKey] || 0)),
    1
  );

  return (
    <div className="analytics-bar-list">
      {items.map((item, index) => {
        const value = Number(item[valueKey] || 0);
        const width = (value / max) * 100;

        return (
          <div
            className="analytics-bar-row"
            key={`${item[labelKey]}-${index}`}
          >
            <div className="analytics-bar-label">
              <span>{item[labelKey] || "Other"}</span>
              <strong>{format(value)}</strong>
            </div>
            <div className="analytics-bar-track">
              <div
                className="analytics-bar-fill"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Analytics() {
  const [from, setFrom] = useState(dateString(monthAgo));
  const [to, setTo] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(async () => {
    if (from && to && from > to) {
      setError("The start date cannot be after the end date.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const response = await fetch(
        `${API_URL}/analytics?${params.toString()}`
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "Unable to load analytics.");
      }

      setData(result);
    } catch (err) {
      setError(err.message || "Unable to load analytics.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const daily = data?.sales?.daily || [];

  return (
    <main className="analytics-page">
      <header className="analytics-header">
        <div>
          <h1>Analytics &amp; Reports</h1>
          <p>Understand sales, stock performance, and ingredient wastage.</p>
        </div>

        <button
          className="analytics-refresh"
          onClick={loadAnalytics}
          disabled={loading}
        >
          <RefreshCw size={17} />
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      <section className="analytics-filters">
        <div>
          <label htmlFor="analytics-from">From</label>
          <input
            id="analytics-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="analytics-to">To</label>
          <input
            id="analytics-to"
            type="date"
            value={to}
            min={from || undefined}
            max={today}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>

        <button
          className="analytics-apply"
          onClick={loadAnalytics}
          disabled={loading}
        >
          Apply dates
        </button>
      </section>

      {error && (
        <div className="analytics-error" role="alert">
          {error}
          <button onClick={loadAnalytics}>Try again</button>
        </div>
      )}

      {loading && !data ? (
        <div className="analytics-loading">Loading analytics from MySQL...</div>
      ) : data ? (
        <>
          <section className="analytics-section">
            <div className="analytics-section-title">
              <Activity size={21} />
              <div>
                <h2>Business Overview</h2>
                <p>Summary for the selected period</p>
              </div>
            </div>

            <div className="analytics-metrics">
              <MetricCard
                title="Total Sales"
                value={money(data.sales.total_sales)}
                icon={IndianRupee}
                tone="blue"
              />
              <MetricCard
                title="Total Bills"
                value={number(data.sales.total_bills)}
                icon={ReceiptText}
                tone="green"
              />
              <MetricCard
                title="Average Bill"
                value={money(data.sales.average_bill)}
                icon={TrendingUp}
                tone="purple"
              />
              <MetricCard
                title="Products"
                value={number(data.products.total_products)}
                icon={Package}
                tone="cyan"
              />
              <MetricCard
                title="Current Stock"
                value={number(data.inventory.total_stock)}
                icon={Package}
                tone="green"
                subtitle="Ingredients combined"
              />
              <MetricCard
                title="Low Stock"
                value={number(data.inventory.low_stock)}
                icon={AlertTriangle}
                tone="orange"
              />
              <MetricCard
                title="Out of Stock"
                value={number(data.inventory.out_of_stock)}
                icon={XCircle}
                tone="red"
              />
              <MetricCard
                title="Stock Value"
                value={money(data.inventory.stock_value)}
                icon={IndianRupee}
                tone="purple"
                subtitle="Based on ingredient unit costs"
              />
            </div>
          </section>

          <section className="analytics-panels">
            <article className="analytics-panel">
              <h2>Daily Sales Trend</h2>
              <p>Revenue by date</p>

              {daily.length ? (
                <div className="analytics-trend">
                  {daily.map((day) => {
                    const max = Math.max(
                      ...daily.map((item) => Number(item.revenue || 0)),
                      1
                    );
                    const height = Math.max(
                      (Number(day.revenue || 0) / max) * 100,
                      3
                    );

                    return (
                      <div className="analytics-trend-item" key={day.date}>
                        <strong>{money(day.revenue)}</strong>
                        <div className="analytics-trend-track">
                          <div
                            className="analytics-trend-bar"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <span>
                          {new Date(`${day.date}T12:00:00`).toLocaleDateString(
                            "en-IN",
                            { day: "2-digit", month: "short" }
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="analytics-empty">
                  No sales recorded for the selected dates.
                </p>
              )}
            </article>

            <article className="analytics-panel">
              <h2>Top-Selling Menu Items</h2>
              <p>Ranked by quantity sold</p>
              <BarList
                items={data.sales.top_items}
                labelKey="menu_item_name"
                valueKey="quantity_sold"
              />
            </article>

            <article className="analytics-panel">
              <h2>Wastage by Reason</h2>
              <p>Quantity wasted in the selected period</p>
              <BarList
                items={data.wastage.by_reason}
                labelKey="reason"
                valueKey="quantity_wasted"
              />
            </article>

            <article className="analytics-panel">
              <h2>Most-Wasted Ingredients</h2>
              <p>Quantity grouped by ingredient</p>
              <BarList
                items={data.wastage.by_ingredient.map((item) => ({
                  ...item,
                  ingredient_label: `${item.ingredient_name} (${item.unit || ""})`,
                }))}
                labelKey="ingredient_label"
                valueKey="quantity_wasted"
              />
            </article>
          </section>

          <section className="analytics-panel analytics-stock-panel">
            <h2>Low-Stock Ingredients</h2>
            <p>Ingredients at or below their minimum stock level</p>

            {data.inventory.low_stock_items.length ? (
              <div className="analytics-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ingredient</th>
                      <th>Available</th>
                      <th>Minimum Stock</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.inventory.low_stock_items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{number(item.quantity)} {item.unit}</td>
                        <td>{number(item.min_stock)} {item.unit}</td>
                        <td>
                          <span className={`analytics-status ${
                            Number(item.quantity) <= 0 ? "out" : "low"
                          }`}>
                            {Number(item.quantity) <= 0
                              ? "Out of stock"
                              : "Low stock"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="analytics-empty">No low-stock ingredients.</p>
            )}
          </section>

          <p className="analytics-footnote">
            Sales and wastage use the selected date range. Inventory figures
            reflect current stock. Stock value uses ingredient cost per unit.
          </p>
        </>
      ) : null}
    </main>
  );
}
