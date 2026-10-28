
import { NavLink } from "react-router-dom";

const Sidebar = () => {
  const menuItems = [
    { name: "Dashboard", path: "/", icon: "🏠" },
    { name: "Products", path: "/products", icon: "📦" },
    { name: "Categories", path: "/categories", icon: "🗂️" },
    { name: "Ingredients", path: "/ingredients", icon: "🥬" },
    { name: "Menu Items", path: "/menu-items", icon: "🍽️" },
    { name: "Recipes / BOM", path: "/recipes", icon: "🍳" },
    { name: "Sales / Billing", path: "/sales", icon: "💳" },
    { name: "Stock Management", path: "/stock", icon: "📊" },
    { name: "Stock History", path: "/stock-history", icon: "📜" },
    { name: "Stock Consumption", path: "/consumption", icon: "📉" },
    { name: "Wastage Management", path: "/wastage", icon: "🗑️" },
    { name: "Customers", path: "/customers", icon: "👥" },

    // New reservation menu item
    { name: "Reservations", path: "/reservations", icon: "📅" },
  ];

  return (
    <aside
      style={{
        width: "250px",
        minHeight: "100vh",
        flexShrink: 0,
        background: "#172554",
        color: "#ffffff",
        padding: "24px 14px",
        boxSizing: "border-box",
      }}
    >
      <h2 style={{ fontSize: "19px", margin: "0 0 28px 8px" }}>
        🍴 Restaurant POS
      </h2>

      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px",
              borderRadius: "8px",
              color: "#ffffff",
              textDecoration: "none",
              background: isActive ? "#3b82f6" : "transparent",
            })}
          >
            <span>{item.icon}</span>
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
