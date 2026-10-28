import CategoryForm from "../components/CategoryForm";

const AddCategory = () => {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Add Category</h1>

          <p>
            Create a new product category
          </p>
        </div>
      </div>

      <CategoryForm />
    </div>
  );
};

export default AddCategory;