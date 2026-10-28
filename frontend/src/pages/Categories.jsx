import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Search,
  Tags,
  Pencil,
  Trash2,
  RefreshCw,
} from "lucide-react";

import {
  getCategories,
  deleteCategory,
} from "../services/CategoryApi";

const Categories = () => {
  const [categories, setCategories] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [deletingId, setDeletingId] =
    useState(null);

  const [error, setError] =
    useState("");

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await getCategories();

      const data = Array.isArray(response)
        ? response
        : response?.data || [];

      setCategories(data);
    } catch (error) {
      console.error(error);

      setError(
        "Unable to load categories. Please check the backend connection."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const filteredCategories =
    categories.filter((category) => {
      const searchText =
        search.toLowerCase().trim();

      if (!searchText) {
        return true;
      }

      return (
        category.name
          ?.toLowerCase()
          .includes(searchText) ||
        category.description
          ?.toLowerCase()
          .includes(searchText)
      );
    });

  const handleDelete = async (id) => {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this category?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(id);
      setError("");

      await deleteCategory(id);

      setCategories((previous) =>
        previous.filter(
          (category) =>
            category.id !== id
        )
      );
    } catch (error) {
      console.error(error);

      setError(
        error.response?.data?.message ||
          "Unable to delete category."
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Categories</h1>

          <p>
            Organize products into categories
          </p>
        </div>

        <Link
          to="/categories/add"
          className="primary-button"
        >
          <Plus size={18} />
          Add Category
        </Link>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="categories-toolbar">
        <div className="search-box">
          <Search size={18} />

          <input
            type="text"
            placeholder="Search categories..."
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />
        </div>

        <button
          className="refresh-button"
          onClick={loadCategories}
          disabled={loading}
          title="Refresh categories"
        >
          <RefreshCw
            size={18}
            className={
              loading ? "spin" : ""
            }
          />
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <RefreshCw
            size={30}
            className="spin"
          />

          <p>
            Loading categories...
          </p>
        </div>
      ) : filteredCategories.length ===
        0 ? (
        <div className="empty-state">
          <Tags size={45} />

          <h3>
            {search
              ? "No categories found"
              : "No categories available"}
          </h3>

          <p>
            {search
              ? "Try changing your search."
              : "Create your first category to organize products."}
          </p>

          {!search && (
            <Link
              to="/categories/add"
              className="primary-button"
            >
              <Plus size={18} />
              Add Category
            </Link>
          )}
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Description</th>
                <th>Products</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredCategories.map(
                (category) => (
                  <tr
                    key={category.id}
                  >
                    <td>
                      <div className="category-name">
                        <div className="category-icon">
                          <Tags size={17} />
                        </div>

                        <strong>
                          {category.name}
                        </strong>
                      </div>
                    </td>

                    <td>
                      {category.description ||
                        "-"}
                    </td>

                    <td>
                      {category._count
                        ?.products ??
                        category.productCount ??
                        "-"}
                    </td>

                    <td>
                      <div className="action-buttons">
                        <Link
                          to={`/categories/edit/${category.id}`}
                          className="icon-action edit-action"
                          title="Edit category"
                        >
                          <Pencil
                            size={16}
                          />
                        </Link>

                        <button
                          className="icon-action delete-action"
                          title="Delete category"
                          disabled={
                            deletingId ===
                            category.id
                          }
                          onClick={() =>
                            handleDelete(
                              category.id
                            )
                          }
                        >
                          {deletingId ===
                          category.id ? (
                            <RefreshCw
                              size={16}
                              className="spin"
                            />
                          ) : (
                            <Trash2
                              size={16}
                            />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Categories;