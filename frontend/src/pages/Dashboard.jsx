
import { useEffect, useState } from "react";
import {
  Package,
  Boxes,
  AlertTriangle,
  XCircle,
  IndianRupee,
  Receipt,
  Users,
  CalendarDays,
  ChefHat,
  Recycle,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Activity,
} from "lucide-react";

import { getProducts } from "../services/productApi";
import { getInventory } from "../services/inventoryApi";

import "../styles/dashboard.css";


const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/$/, "");

const getArray = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.sales)) return data.sales;
  if (Array.isArray(data?.reservations)) return data.reservations;
  if (Array.isArray(data?.customers)) return data.customers;
  if (Array.isArray(data?.ingredients)) return data.ingredients;
  if (Array.isArray(data?.menu_items)) return data.menu_items;
  return [];
};

const getNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const getSaleTotal = (sale) =>
  getNumber(
    sale.total_amount ??
    sale.grand_total ??
    sale.total ??
    sale.final_amount ??
    sale.amount
  );

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);

async function fetchFirstAvailable(paths) {
  for (const path of paths) {
    try {
      const response = await fetch(`${API_URL}${path}`);

      if (!response.ok) continue;

      return await response.json();
    } catch (error) {
      console.warn(`Dashboard could not load ${path}:`, error.message);
    }
  }

  return null;
}

const Dashboard = () => {
  const [data, setData] = useState({
    products: [],
    inventory: [],
    sales: [],
    ingredients: [],
    menuItems: [],
    customers: [],
    reservations: [],
    wastage: null,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const results = await Promise.allSettled([
        getProducts(),
        getInventory(),
        fetchFirstAvailable(["/sales", "/sales/history"]),
        fetchFirstAvailable(["/ingredients"]),
        fetchFirstAvailable(["/menu-items"]),
        fetchFirstAvailable(["/customers"]),
        fetchFirstAvailable(["/reservations"]),
        fetchFirstAvailable(["/wastage/reports"]),
      ]);

      const unwrap = (result, fallback = null) =>
        result.status === "fulfilled" ? result.value : fallback;

      const productsResult = unwrap(results[0], []);
      const inventoryResult = unwrap(results[1], []);

      const products = getArray(productsResult);
      const inventory = getArray(inventoryResult);

      const sales = getArray(unwrap(results[2], []));
      const ingredients = getArray(unwrap(results[3], []));
      const menuItems = getArray(unwrap(results[4], []));
      const customers = getArray(unwrap(results[5], []));
      const reservations = getArray(unwrap(results[6], []));
      const wastage = unwrap(results[7], null);

      setData({
        products,
        inventory,
        sales,
        ingredients,
        menuItems,
        customers,
        reservations,
        wastage,
      });

      if (
        results[0].status === "rejected" &&
        results[1].status === "rejected"
      ) {
        setError(
          "Could not load products or inventory. Check that your backend is running."
        );
      }
    } catch (err) {
      console.error("Dashboard loading error:", err);
      setError("Unable to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const {
    products,
    inventory,
    sales,
    ingredients,
    menuItems,
    customers,
    reservations,
    wastage,
  } = data;

  const totalStock = inventory.reduce(
    (sum, item) => sum + getNumber(item.quantity),
    0
  );

  const lowStock = inventory.filter((item) => {
    const quantity = getNumber(item.quantity);
    const reorder = getNumber(
      item.reorderLevel ?? item.reorder_level ?? item.min_stock
    );

    return quantity > 0 && quantity <= reorder;
  });

  const outOfStock = inventory.filter(
    (item) => getNumber(item.quantity) <= 0
  );

  const totalSales = sales.reduce(
    (sum, sale) => sum + getSaleTotal(sale),
    0
  );

  const pendingReservations = reservations.filter((reservation) =>
    ["PENDING", "CONFIRMED"].includes(
      String(reservation.status || "").toUpperCase()
    )
  );

  const wastageRecords = getNumber(
    wastage?.summary?.total_records
  );

  const statCards = [
    {
      title: "Total Sales",
      value: formatCurrency(totalSales),
      icon: IndianRupee,
      color: "blue",
    },
    {
      title: "Total Bills",
      value: sales.length,
      icon: Receipt,
      color: "green",
    },
    {
      title: "Products",
      value: products.length,
      icon: Package,
      color: "purple",
    },
    {
      title: "Total Stock",
      value: totalStock.toLocaleString("en-IN"),
      icon: Boxes,
      color: "cyan",
    },
    {
      title: "Low Stock",
      value: lowStock.length,
      icon: AlertTriangle,
      color: "orange",
    },
    {
      title: "Out of Stock",
      value: outOfStock.length,
      icon: XCircle,
      color: "red",
    },
    {
      title: "Ingredients",
      value: ingredients.length,
      icon: ShoppingBag,
      color: "green",
    },
    {
      title: "Menu Items",
      value: menuItems.length,
      icon: ChefHat,
      color: "purple",
    },
    {
      title: "Customers",
      value: customers.length,
      icon: Users,
      color: "blue",
    },
    {
      title: "Reservations",
      value: pendingReservations.length,
      icon: CalendarDays,
      color: "cyan",
    },
    {
      title: "Wastage Records",
      value: wastage?.summary
        ? wastageRecords
        : "—",
      icon: Recycle,
      color: "orange",
    },
  ];

  if (loading) {
    return (
      <div className="page dashboard-page">
        <div className="page-header">
          <div>
            <h1>Restaurant Dashboard</h1>
            <p>Loading your restaurant overview...</p>
          </div>
        </div>
        <div className="dashboard-loading">
          <RefreshCw className="spin-icon" size={24} />
          Loading dashboard data...
        </div>
      </div>
    );
  }

  return (
    <div className="page dashboard-page">
      <div className="page-header dashboard-heading">
        <div>
         
          <h1>Restaurant Dashboard</h1>
          <p>
            Monitor sales, inventory, customers, reservations,
            and wastage in one place.
          </p>
        </div>

        <button
          className="dashboard-refresh"
          onClick={() => loadDashboard(true)}
          disabled={refreshing}
        >
          <RefreshCw
            size={17}
            className={refreshing ? "spin-icon" : ""}
          />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="dashboard-error" role="alert">
          {error}
        </div>
      )}

      <div className="dashboard-section-title">
        <div>
          <h2>Business Overview</h2>
          <p>Live data from your connected APIs</p>
        </div>
        <Activity size={23} />
      </div>

      <div className="stats-grid restaurant-stats-grid">
        {statCards.map((stat) => {
          const Icon = stat.icon;

          return (
            <div className="stat-card restaurant-stat-card" key={stat.title}>
              <div className={`stat-icon stat-icon-${stat.color}`}>
                <Icon size={23} />
              </div>

              <div className="restaurant-stat-content">
                <span>{stat.title}</span>
                <h2>{stat.value}</h2>
              </div>
            </div>
          );
        })}
      </div>

      <div className="dashboard-panels">
        <section className="dashboard-section">
          <div className="section-header">
            <div>
              <h2>Inventory Status</h2>
              <p>Current stock and reorder levels</p>
            </div>
            <Boxes size={21} />
          </div>

          {inventory.length === 0 ? (
            <div className="dashboard-empty">
              No inventory records available.
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th>Reorder Level</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.slice(0, 8).map((item, index) => {
                    const quantity = getNumber(item.quantity);
                    const reorder = getNumber(
                      item.reorderLevel ??
                      item.reorder_level ??
                      item.min_stock
                    );

                    const status =
                      quantity <= 0
                        ? "Out of Stock"
                        : quantity <= reorder
                        ? "Low Stock"
                        : "In Stock";

                    return (
                      <tr key={item.id ?? item.inventory_id ?? index}>
                        <td>
                          {item.product?.name ||
                            item.productName ||
                            item.product_name ||
                            item.name ||
                            "-"}
                        </td>
                        <td>{quantity}</td>
                        <td>{reorder}</td>
                        <td>
                          <span
                            className={`status ${status
                              .toLowerCase()
                              .replaceAll(" ", "-")}`}
                          >
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="dashboard-section">
          <div className="section-header">
            <div>
              <h2>Stock Alerts</h2>
              <p>Items that need attention</p>
            </div>
            <AlertTriangle size={21} />
          </div>

          {lowStock.length === 0 && outOfStock.length === 0 ? (
            <div className="dashboard-empty">
              <Boxes size={28} />
              <p>No low-stock or out-of-stock items found.</p>
            </div>
          ) : (
            <div className="dashboard-alert-list">
              {[...outOfStock, ...lowStock].slice(0, 8).map((item, index) => {
                const quantity = getNumber(item.quantity);
                const name =
                  item.product?.name ||
                  item.product_name ||
                  item.productName ||
                  item.name ||
                  "Inventory item";

                return (
                  <div
                    className="dashboard-alert-item"
                    key={item.id ?? item.inventory_id ?? index}
                  >
                    <span
                      className={`dashboard-alert-icon ${
                        quantity <= 0 ? "alert-critical" : "alert-warning"
                      }`}
                    >
                      {quantity <= 0 ? (
                        <XCircle size={19} />
                      ) : (
                        <AlertTriangle size={19} />
                      )}
                    </span>
                    <div>
                      <strong>{name}</strong>
                      <p>
                        {quantity <= 0
                          ? "Out of stock"
                          : `Only ${quantity} remaining`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className="dashboard-panels">
        <section className="dashboard-section">
          <div className="section-header">
            <div>
              <h2>Recent Sales</h2>
              <p>Latest billing records returned by the sales API</p>
            </div>
            <TrendingUp size={21} />
          </div>

          {sales.length === 0 ? (
            <div className="dashboard-empty">
              No sales data available. Check your sales GET endpoint.
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Sale ID</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...sales]
                    .slice(-6)
                    .reverse()
                    .map((sale, index) => (
                      <tr key={sale.id ?? sale.sale_id ?? index}>
                        <td>
                          #{sale.id ?? sale.sale_id ?? "—"}
                        </td>
                        <td>
                          {sale.created_at
                            ? new Date(sale.created_at).toLocaleDateString("en-IN")
                            : sale.sale_date
                            ? new Date(sale.sale_date).toLocaleDateString("en-IN")
                            : "—"}
                        </td>
                        <td>{formatCurrency(getSaleTotal(sale))}</td>
                        <td>
                          <span className="status in-stock">
                            {sale.status || "Recorded"}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="dashboard-section">
          <div className="section-header">
            <div>
              <h2>Wastage Overview</h2>
              <p>Summary from the wastage reports API</p>
            </div>
            <Recycle size={21} />
          </div>

          {!wastage?.summary ? (
            <div className="dashboard-empty">
              Wastage report unavailable. Check
              {" "}/api/wastage/reports.
            </div>
          ) : (
            <>
              <div className="wastage-summary">
                <span>Total records</span>
                <strong>{wastage.summary.total_records ?? 0}</strong>
              </div>

              <div className="wastage-summary">
                <span>Ingredients affected</span>
                <strong>{wastage.summary.ingredients_affected ?? 0}</strong>
              </div>

              <div className="dashboard-reason-list">
                {(wastage.by_reason || []).slice(0, 5).map((item) => (
                  <div className="dashboard-reason-row" key={item.reason}>
                    <span>
                      {String(item.reason || "")
                        .replaceAll("_", " ")
                        .toLowerCase()}
                    </span>
                    <strong>{item.record_count}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <div className="dashboard-footer-note">
        <Activity size={17} />
        Dashboard information depends on the data returned by each API.
        A missing module's data does not mean its database is empty.
      </div>
    </div>
  );
};

export default Dashboard;
