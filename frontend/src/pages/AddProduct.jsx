import ProductForm from "../components/ProductForm";

const AddProduct = () => {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Add Product</h1>

          <p>
            Add a new product to inventory
          </p>
        </div>
      </div>

      <ProductForm />
    </div>
  );
};

export default AddProduct;