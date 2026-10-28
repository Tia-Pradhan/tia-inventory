
async function testSales() {
  try {
    const response = await fetch(
      "http://localhost:5000/api/sales",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              menu_item_id: 2,
              quantity: 1,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    console.log("Status:", response.status);
    console.log("Response:", data);
  } catch (error) {
    console.error("Request failed:", error.message);
  }
}

testSales();
