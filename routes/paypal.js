// routes/paypal.js
const express = require("express");
const router = express.Router();
const axios = require("axios");

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
// Koristimo sandbox za testiranje – u produkciji promenite u "https://api-m.paypal.com"
const PAYPAL_API_BASE = process.env.PAYPAL_MODE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

// Endpoint za kreiranje porudžbine
router.post("/create-order", async (req, res) => {
  const { amount, currency, description } = req.body;
  try {
    // Dobijanje pristupnog tokena
    const authResponse = await axios({
      url: `${PAYPAL_API_BASE}/v1/oauth2/token`,
      method: "post",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      auth: {
        username: PAYPAL_CLIENT_ID,
        password: PAYPAL_SECRET,
      },
      data: "grant_type=client_credentials",
    });
    const accessToken = authResponse.data.access_token;

    // Kreiranje porudžbine
    const orderResponse = await axios({
      url: `${PAYPAL_API_BASE}/v2/checkout/orders`,
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      data: {
        intent: "CAPTURE",
        purchase_units: [
          {
            description: description || "Kupovina tokena",
            amount: {
              currency_code: currency,
              value: amount,
            },
          },
        ],
      },
    });

    res.json(orderResponse.data);
  } catch (error) {
    console.error("Greška pri kreiranju porudžbine:", error.response ? error.response.data : error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint za potvrdu porudžbine
router.post("/capture-order", async (req, res) => {
  const { orderID } = req.body;
  try {
    // Dobijanje pristupnog tokena
    const authResponse = await axios({
      url: `${PAYPAL_API_BASE}/v1/oauth2/token`,
      method: "post",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      auth: {
        username: PAYPAL_CLIENT_ID,
        password: PAYPAL_SECRET,
      },
      data: "grant_type=client_credentials",
    });
    const accessToken = authResponse.data.access_token;

    // Potvrda porudžbine
    const captureResponse = await axios({
      url: `${PAYPAL_API_BASE}/v2/checkout/orders/${orderID}/capture`,
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    res.json(captureResponse.data);
  } catch (error) {
    console.error("Greška pri potvrdi porudžbine:", error.response ? error.response.data : error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
