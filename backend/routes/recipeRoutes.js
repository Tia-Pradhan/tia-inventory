
const express = require("express");
const router = express.Router();

const recipeController = require("../controllers/recipeController");

// Verify that every route handler exists.
const requiredHandlers = [
  "getIngredients",
  "getMenuItems",
  "getRecipes",
  "getRecipeById",
  "createRecipe",
  "updateRecipe",
  "deleteRecipe",
];

for (const handler of requiredHandlers) {
  if (typeof recipeController[handler] !== "function") {
    throw new Error(
      `recipeController.${handler} is missing or is not a function`
    );
  }
}

router.get("/ingredients", recipeController.getIngredients);
router.get("/menu-items", recipeController.getMenuItems);
router.get("/", recipeController.getRecipes);
router.get("/:id", recipeController.getRecipeById);
router.post("/", recipeController.createRecipe);
router.put("/:id", recipeController.updateRecipe);
router.delete("/:id", recipeController.deleteRecipe);

module.exports = router;
