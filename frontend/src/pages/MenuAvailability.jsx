
import { useEffect, useState } from "react";
import { getMenuAvailability } from "../services/availabilityApi";
import "../styles/menuAvailability.css";

export default function MenuAvailability() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAvailability() {
    try {
      setLoading(true);
      setError("");

      const data = await getMenuAvailability();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load menu availability.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAvailability();
  }, []);

  return (
    <div className="availability-page">
      <div className="availability-heading">
        <div>
          <h1>Menu Availability</h1>
          <p>
            Check menu availability using recipes and current ingredient stock.
          </p>
        </div>

        <button
          className="availability-refresh"
          onClick={loadAvailability}
          disabled={loading}
        >
          {loading ? "Loading..." : "↻ Refresh"}
        </button>
      </div>

      {error && <div className="availability-error">{error}</div>}

      {loading ? (
        <p>Loading menu availability...</p>
      ) : items.length === 0 ? (
        <p>No menu items found.</p>
      ) : (
        <div className="availability-grid">
          {items.map((item) => (
            <article className="availability-card" key={item.id}>
              <div className="availability-card-heading">
                <div>
                  <h2>{item.name}</h2>
                  <p>
                    Selling price: ₹
                    {Number(item.selling_price || 0).toFixed(2)}
                  </p>
                </div>

                <span
                  className={`availability-badge ${
                    item.available ? "is-available" : "is-unavailable"
                  }`}
                >
                  {item.available ? "Available" : "Unavailable"}
                </span>
              </div>

              <h3>Ingredient Stock</h3>

              {item.ingredients?.length > 0 ? (
                <div className="availability-table-wrap">
                  <table className="availability-table">
                    <thead>
                      <tr>
                        <th>Ingredient</th>
                        <th>Stock</th>
                        <th>Required / Serving</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.ingredients.map((ingredient) => (
                        <tr key={ingredient.ingredient_id}>
                          <td>{ingredient.ingredient_name}</td>
                          <td>
                            {Number(ingredient.available_stock).toFixed(3)}{" "}
                            {ingredient.unit}
                          </td>
                          <td>
                            {Number(ingredient.required_stock).toFixed(3)}{" "}
                            {ingredient.unit}
                          </td>
                          <td>
                            {ingredient.sufficient
                              ? "In stock"
                              : "Insufficient"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No recipe ingredients configured.</p>
              )}

              {item.reasons?.length > 0 && (
                <div className="availability-reasons">
                  <strong>Reasons</strong>
                  <ul>
                    {item.reasons.map((reason, index) => (
                      <li key={index}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
