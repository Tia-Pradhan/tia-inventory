import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Search,
  Package,
  Pencil,
  Trash2,
  RefreshCw,
} from "lucide-react";

import {
  getProducts,
  deleteProduct,
} from "../services/productApi";

const Products = () => {
  const [products, setProducts] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [deletingId, setDeletingId] =
    useState(null);

  const [error, setError] =
    useState("");

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await getProducts();

      const data = Array.isArray(response)
        ? response
        : response?.data || [];

      setProducts(data);
    } catch (error) {
      console.error(error);

      setError(
        "Unable to load products. Please check the backend connection."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filteredProducts =
    products.filter((product) => {
      const searchText =
        search.toLowerCase().trim();

      if (!searchText) {
        return true;
      }

      return (
        product.name
          ?.toLowerCase()
          .includes(searchText) ||
        product.sku
          ?.toLowerCase()
          .includes(searchText) ||
        product.barcode
          ?.toLowerCase()
          .includes(searchText) ||
        product.category?.name
          ?.toLowerCase()
          .includes(searchText)
      );
    });

  const getQuantity = (product) => {
    return Number(
      product.inventory?.quantity ??
        product.quantity ??
        0
    );
  };

  const getStatus = (product) => {
    const quantity =
      getQuantity(product);

    const reorderLevel = Number(
      product.inventory?.reorderLevel ??
        product.reorderLevel ??
        0
    );

    if (quantity === 0) {
      return "Out of Stock";
    }

    if (quantity <= reorderLevel) {
      return "Low Stock";
    }

    return "In Stock";
  };

  const handleDelete = async (id) => {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this product?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(id);
      setError("");

      await deleteProduct(id);

      setProducts((previous) =>
        previous.filter(
          (product) =>
            product.id !== id
        )
      );
    } catch (error) {
      console.error(error);

      setError(
        error.response?.data?.message ||
          "Unable to delete the product."
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Products</h1>

          <p>
            Manage products and inventory information
          </p>
        </div>

        <Link
          to="/products/add"
          className="primary-button"
        >
          <Plus size={18} />
          Add Product
        </Link>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="products-toolbar">
        <div className="search-box">
          <Search size={18} />

          <input
            type="text"
            placeholder="Search by name, SKU, barcode or category..."
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
          onClick={loadProducts}
          disabled={loading}
          title="Refresh products"
        >
          <RefreshCw
            size={18}
            className={
              loading
                ? "spin"
                : ""
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
            Loading products...
          </p>
        </div>
      ) : filteredProducts.length ===
        0 ? (
        <div className="empty-state">
          <Package size={45} />

          <h3>
            {search
              ? "No products found"
              : "No products available"}
          </h3>

          <p>
            {search
              ? "Try changing your search."
              : "Products added to the inventory will appear here."}
          </p>

          {!search && (
            <Link
              to="/products/add"
              className="primary-button"
            >
              <Plus size={18} />
              Add Product
            </Link>
          )}
        </div>
      ) : (
        <div className="table-container products-table">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Barcode</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map(
                (product) => {
                  const quantity =
                    getQuantity(product);

                  const status =
                    getStatus(product);

                  return (
                    <tr
                      key={product.id}
                    >
                      <td>
                        <div className="product-name">
                          {product.name}
                        </div>
                      </td>

                      <td>
                        {product.sku ||
                          "-"}
                      </td>

                      <td>
                        {product.barcode ||
                          "-"}
                      </td>

                      <td>
                        {product.category
                          ?.name ||
                          "-"}
                      </td>

                      <td>
                        ₹
                        {Number(
                          product.sellingPrice ??
                            0
                        ).toFixed(2)}
                      </td>

                      <td>
                        {quantity}
                      </td>

                      <td>
                        <span
                          className={`status ${status
                            .toLowerCase()
                            .replaceAll(
                              " ",
                              "-"
                            )}`}
                        >
                          {status}
                        </span>
                      </td>

                      <td>
                        <div className="action-buttons">
                          <Link
                            to={`/products/edit/${product.id}`}
                            className="icon-action edit-action"
                            title="Edit product"
                          >
                            <Pencil
                              size={16}
                            />
                          </Link>

                          <button
                            className="icon-action delete-action"
                            title="Delete product"
                            disabled={
                              deletingId ===
                              product.id
                            }
                            onClick={() =>
                              handleDelete(
                                product.id
                              )
                            }
                          >
                            {deletingId ===
                            product.id ? (
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
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Products;