
import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import "./recipes.css";

const emptyForm = {
  menu_item_id: "",
  yield_quantity: "1",
  yield_unit: "serving",
  instructions: "",
};

const emptyIngredient = {
  ingredient_id: "",
  quantity: "",
  unit: "g",
};

function getRows(response) {
  const data = response?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.recipes)) return data.recipes;
  if (Array.isArray(data?.ingredients)) return data.ingredients;
  if (Array.isArray(data?.menuItems)) return data.menuItems;
  if (Array.isArray(data?.items)) return data.items;

  return [];
}

export default function Recipes() {
  const [recipes, setRecipes] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [availableIngredients, setAvailableIngredients] = useState([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [ingredients, setIngredients] = useState([
    { ...emptyIngredient },
  ]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      api.get("/recipes"),
      api.get("/recipes/ingredients"),
      api.get("/menu-items"),
    ]);

    const [recipeResult, ingredientResult, menuResult] = results;
    const errors = [];

    if (recipeResult.status === "fulfilled") {
      setRecipes(getRows(recipeResult.value));
    } else {
      console.error("Recipes API error:", recipeResult.reason);
      setRecipes([]);
      errors.push("Could not load saved recipes.");
    }

    if (ingredientResult.status === "fulfilled") {
      setAvailableIngredients(getRows(ingredientResult.value));
    } else {
      console.error("Ingredients API error:", ingredientResult.reason);
      setAvailableIngredients([]);
      errors.push("Could not load ingredients.");
    }

    if (menuResult.status === "fulfilled") {
      setMenuItems(getRows(menuResult.value));
    } else {
      console.error("Menu items API error:", menuResult.reason);
      setMenuItems([]);
      errors.push("Could not load menu items.");
    }

    if (errors.length) setError(errors.join(" "));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function updateForm(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function updateIngredient(index, field, value) {
    setIngredients((previous) =>
      previous.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  }

  function addIngredient() {
    setIngredients((previous) => [
      ...previous,
      { ...emptyIngredient },
    ]);
  }

  function removeIngredient(index) {
    setIngredients((previous) =>
      previous.filter((_, i) => i !== index)
    );
  }

  function resetForm() {
    setForm({ ...emptyForm });
    setIngredients([{ ...emptyIngredient }]);
    setEditingId(null);
  }

  // FIXED: send the field names expected by the existing backend.
  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.menu_item_id) {
      setError("Please select a menu item.");
      return;
    }

    if (
      !Number.isFinite(Number(form.yield_quantity)) ||
      Number(form.yield_quantity) <= 0
    ) {
      setError("Enter a valid yield quantity.");
      return;
    }

    if (
      ingredients.length === 0 ||
      ingredients.some(
        (item) =>
          !item.ingredient_id ||
          item.quantity === "" ||
          !Number.isFinite(Number(item.quantity)) ||
          Number(item.quantity) <= 0
      )
    ) {
      setError("Select an ingredient and enter valid quantities.");
      return;
    }

    if (editingId !== null && ingredients.length !== 1) {
      setError(
        "When editing, keep only the ingredient you want to update."
      );
      return;
    }

    const ingredientIds = ingredients.map((item) =>
      Number(item.ingredient_id)
    );

    if (new Set(ingredientIds).size !== ingredientIds.length) {
      setError("Each ingredient can only be added once per recipe.");
      return;
    }

    setSaving(true);

    try {
      const commonData = {
        menu_item_id: Number(form.menu_item_id),
        yield_quantity: Number(form.yield_quantity),
        yield_unit: form.yield_unit || "serving",
      };

      if (editingId !== null) {
        const item = ingredients[0];

        await api.put(`/recipes/${editingId}`, {
          ...commonData,
          ingredient_id: Number(item.ingredient_id),
          quantity_required: Number(item.quantity),
        });

        setSuccess("Recipe ingredient updated successfully.");
      } else {
        // The current backend stores one ingredient per recipe row.
        // Save each selected ingredient separately.
        for (const item of ingredients) {
          await api.post("/recipes", {
            ...commonData,
            ingredient_id: Number(item.ingredient_id),
            quantity_required: Number(item.quantity),
          });
        }

        setSuccess("Recipe saved successfully.");
      }

      resetForm();
      await loadData();
    } catch (err) {
      console.error(
        "Save recipe error:",
        err.response?.data || err
      );

      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Unable to save recipe. Check the backend terminal."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(id) {
    setError("");
    setSuccess("");

    try {
      const response = await api.get(`/recipes/${id}`);
      const recipe = response.data?.data || response.data;

      setForm({
        menu_item_id: String(recipe.menu_item_id ?? ""),
        yield_quantity: String(recipe.yield_quantity ?? 1),
        yield_unit: recipe.yield_unit || "serving",
        instructions: recipe.instructions || "",
      });

      setIngredients([
        {
          ingredient_id: String(recipe.ingredient_id ?? ""),
          quantity: String(
            recipe.quantity_required ?? recipe.quantity ?? ""
          ),
          unit:
            recipe.ingredient_unit ||
            recipe.unit ||
            "g",
        },
      ]);

      setEditingId(id);

      document
        .getElementById("recipe-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      console.error("Load recipe error:", err.response?.data || err);

      setError(
        err.response?.data?.message ||
          "Unable to load this recipe for editing."
      );
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Are you sure you want to delete this recipe?")) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await api.delete(`/recipes/${id}`);

      if (String(editingId) === String(id)) resetForm();

      setSuccess("Recipe deleted successfully.");
      await loadData();
    } catch (err) {
      console.error("Delete recipe error:", err.response?.data || err);

      setError(
        err.response?.data?.message ||
          "Unable to delete this recipe."
      );
    }
  }

  function getMenuItemName(recipe) {
    return (
      recipe.menu_item_name ||
      menuItems.find(
        (item) =>
          String(item.id) === String(recipe.menu_item_id)
      )?.name ||
      `Menu item #${recipe.menu_item_id}`
    );
  }

  return (
    <div className="recipes-page">
      <div className="recipes-heading">
        <div>
          <h1>Recipes / BOM</h1>
          <p>Manage menu recipes, ingredients, quantities, and units.</p>
        </div>

        <button
          type="button"
          className="recipe-secondary-button"
          onClick={loadData}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "↻ Refresh"}
        </button>
      </div>

      {error && (
        <div className="recipe-alert recipe-alert-error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="recipe-alert recipe-alert-success" role="status">
          {success}
        </div>
      )}

      <section className="recipe-card" id="recipe-form">
        <h2>{editingId !== null ? "Edit Recipe" : "Create Recipe"}</h2>
        <p>Choose a menu item and specify its ingredient requirements.</p>

        <form onSubmit={handleSubmit}>
          <div className="recipe-form-grid">
            <div className="recipe-field">
              <label htmlFor="menu_item_id">Menu Item *</label>
              <select
                id="menu_item_id"
                name="menu_item_id"
                value={form.menu_item_id}
                onChange={updateForm}
                required
              >
                <option value="">Select menu item</option>
                {menuItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="recipe-field">
              <label htmlFor="yield_quantity">Yield Quantity *</label>
              <input
                id="yield_quantity"
                name="yield_quantity"
                type="number"
                min="0.001"
                step="0.001"
                value={form.yield_quantity}
                onChange={updateForm}
                required
              />
            </div>

            <div className="recipe-field">
              <label htmlFor="yield_unit">Yield Unit *</label>
              <select
                id="yield_unit"
                name="yield_unit"
                value={form.yield_unit}
                onChange={updateForm}
                required
              >
                <option value="serving">Serving</option>
                <option value="piece">Piece</option>
                <option value="portion">Portion</option>
                <option value="kg">Kilogram (kg)</option>
                <option value="litre">Litre</option>
                <option value="batch">Batch</option>
              </select>
            </div>
          </div>

          <div className="recipe-ingredients-heading">
            <h3>Ingredients</h3>
            <button
              type="button"
              className="recipe-secondary-button"
              onClick={addIngredient}
            >
              + Add Ingredient
            </button>
          </div>

          {ingredients.map((item, index) => (
            <div className="recipe-ingredient-row" key={index}>
              <div className="recipe-field">
                <label htmlFor={`ingredient-${index}`}>
                  Ingredient *
                </label>
                <select
                  id={`ingredient-${index}`}
                  value={item.ingredient_id}
                  onChange={(event) =>
                    updateIngredient(
                      index,
                      "ingredient_id",
                      event.target.value
                    )
                  }
                  required
                >
                  <option value="">Select ingredient</option>
                  {availableIngredients.map((ingredient) => (
                    <option key={ingredient.id} value={ingredient.id}>
                      {ingredient.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="recipe-field">
                <label htmlFor={`quantity-${index}`}>Quantity *</label>
                <input
                  id={`quantity-${index}`}
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="Enter quantity"
                  value={item.quantity}
                  onChange={(event) =>
                    updateIngredient(index, "quantity", event.target.value)
                  }
                  required
                />
              </div>

              <div className="recipe-field">
                <label htmlFor={`unit-${index}`}>Unit *</label>
                <select
                  id={`unit-${index}`}
                  value={item.unit}
                  onChange={(event) =>
                    updateIngredient(index, "unit", event.target.value)
                  }
                  required
                >
                  <option value="g">Gram (g)</option>
                  <option value="kg">Kilogram (kg)</option>
                  <option value="ml">Millilitre (ml)</option>
                  <option value="l">Litre (l)</option>
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="piece">Piece</option>
                  <option value="tbsp">Tablespoon</option>
                  <option value="tsp">Teaspoon</option>
                </select>
              </div>

              <button
                type="button"
                className="recipe-remove-button"
                onClick={() => removeIngredient(index)}
                disabled={ingredients.length === 1}
                aria-label={`Remove ingredient ${index + 1}`}
              >
                ✕
              </button>
            </div>
          ))}

          {availableIngredients.length === 0 && !loading && (
            <p className="recipe-empty">
              No ingredients loaded. Check the ingredients API.
            </p>
          )}

          <div className="recipe-field recipe-instructions">
            <label htmlFor="instructions">Preparation Instructions</label>
            <textarea
              id="instructions"
              name="instructions"
              rows="3"
              placeholder="Enter preparation instructions (optional)"
              value={form.instructions}
              onChange={updateForm}
            />
          </div>

          <div className="recipe-form-actions">
            <button
              type="submit"
              className="recipe-primary-button"
              disabled={
                saving ||
                loading ||
                menuItems.length === 0 ||
                availableIngredients.length === 0
              }
            >
              {saving
                ? "Saving..."
                : editingId !== null
                  ? "Update Recipe"
                  : "Save Recipe"}
            </button>

            {editingId !== null && (
              <button
                type="button"
                className="recipe-secondary-button"
                onClick={resetForm}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="recipe-card">
        <div className="recipe-list-heading">
          <div>
            <h2>Saved Recipes</h2>
            <p>Recipes stored in your database.</p>
          </div>
          <span>{recipes.length} rows</span>
        </div>

        {loading ? (
          <p className="recipe-empty">Loading recipes...</p>
        ) : recipes.length === 0 ? (
          <p className="recipe-empty">
            No recipes found. Create your first recipe above.
          </p>
        ) : (
          <div className="recipe-table-wrapper">
            <table className="recipe-table">
              <thead>
                <tr>
                  <th>Menu Item</th>
                  <th>Ingredient</th>
                  <th>Quantity Required</th>
                  <th>Yield</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recipes.map((recipe) => (
                  <tr key={recipe.id}>
                    <td>{getMenuItemName(recipe)}</td>
                    <td>{recipe.ingredient_name || recipe.ingredient_id}</td>
                    <td>
                      {recipe.quantity_required}{" "}
                      {recipe.ingredient_unit || ""}
                    </td>
                    <td>
                      {recipe.yield_quantity} {recipe.yield_unit}
                    </td>
                    <td>
                      <div className="recipe-row-actions">
                        <button
                          type="button"
                          className="recipe-edit-button"
                          onClick={() => handleEdit(recipe.id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="recipe-delete-button"
                          onClick={() => handleDelete(recipe.id)}
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
    </div>
  );
}
