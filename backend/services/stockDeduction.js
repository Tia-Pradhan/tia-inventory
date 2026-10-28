
async function deductRecipeStock(connection, menuItemId, soldQuantity, saleId = null) {
  if (!Number.isInteger(Number(menuItemId)) ||
      Number(menuItemId) <= 0 ||
      !Number.isFinite(Number(soldQuantity)) ||
      Number(soldQuantity) <= 0) {
    throw new Error("Invalid menu item or sold quantity.");
  }

  // Your existing recipes table has one row per ingredient.
  const [recipes] = await connection.query(
    `SELECT ingredient_id, quantity_required, yield_quantity
     FROM recipes
     WHERE menu_item_id = ?
     ORDER BY ingredient_id`,
    [menuItemId]
  );

  if (recipes.length === 0) {
    throw new Error(
      `Cannot complete sale: no recipe configured for menu item ${menuItemId}.`
    );
  }

  // Calculate the total ingredient requirement for this sale line.
  const requirements = new Map();

  for (const recipe of recipes) {
    const yieldQuantity = Number(recipe.yield_quantity);
    const requiredQuantity = Number(recipe.quantity_required);
    const ingredientId = Number(recipe.ingredient_id);

    if (
      !Number.isFinite(yieldQuantity) ||
      yieldQuantity <= 0 ||
      !Number.isFinite(requiredQuantity) ||
      requiredQuantity <= 0
    ) {
      throw new Error(`Invalid recipe quantities for menu item ${menuItemId}.`);
    }

    const needed = (requiredQuantity / yieldQuantity) * Number(soldQuantity);

    requirements.set(
      ingredientId,
      (requirements.get(ingredientId) || 0) + needed
    );
  }

  // Lock stock rows and verify all required quantities.
  const deductions = [];

  for (const [ingredientId, needed] of requirements) {
    const [rows] = await connection.query(
      `SELECT id, name, quantity
       FROM ingredients
       WHERE id = ?
       FOR UPDATE`,
      [ingredientId]
    );

    if (rows.length === 0) {
      throw new Error(`Ingredient ${ingredientId} was not found.`);
    }

    const ingredient = rows[0];
    const currentStock = Number(ingredient.quantity);

    if (!Number.isFinite(currentStock) || currentStock < needed - 0.000001) {
      throw new Error(
        `Insufficient stock for ${ingredient.name}. ` +
        `Available: ${currentStock}, required: ${needed.toFixed(3)}.`
      );
    }

    deductions.push({
      ingredientId,
      name: ingredient.name,
      quantity: needed,
    });
  }

  // Deduct stock and log each movement in the same transaction.
  for (const item of deductions) {
    await connection.query(
      `UPDATE ingredients
       SET quantity = quantity - ?
       WHERE id = ?`,
      [item.quantity, item.ingredientId]
    );

    const note = saleId == null
      ? "Automatic deduction from completed sale"
      : `Automatic deduction from sale #${saleId}`;

    await connection.query(
      `INSERT INTO stock_consumption
       (ingredient_id, menu_item_id, quantity, source, notes)
       VALUES (?, ?, ?, 'sale', ?)`,
      [item.ingredientId, menuItemId, item.quantity, note]
    );
  }

  return deductions;
}

module.exports = { deductRecipeStock };
