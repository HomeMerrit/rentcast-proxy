const express = require("express");
const axios = require("axios");
const app = express();
require("dotenv").config();

app.use(express.json());

// 🔹 1. Long-term Rent Estimate
app.get("/rentcast", async (req, res) => {
  try {
    const response = await axios.get("https://api.rentcast.io/v1/avm/rent/long-term", {
      headers: {
        "X-Api-Key": process.env.RENTCAST_API_KEY,
      },
      params: req.query,
    });

    const { rent, rentRangeLow, rentRangeHigh, confidenceScore } = response.data;

    res.status(200).json({
      rent,
      rentRangeLow,
      rentRangeHigh,
      confidenceScore,
    });
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: "RentCast API error",
      details: err.response?.data || err.message,
    });
  }
});

// 🔹 2. Property Details (APN + Legal Description)
app.get("/property-details", async (req, res) => {
  try {
    const response = await axios.get("https://api.rentcast.io/v1/properties", {
      headers: {
        "X-Api-Key": process.env.RENTCAST_API_KEY,
      },
      params: req.query,
    });

    const property = response.data?.[0]; // RentCast returns an array

    if (!property) {
      return res.status(404).json({ error: "No property data found" });
    }

    const { assessorID, legalDescription } = property;

    res.status(200).json({
      assessorID,
      legalDescription,
    });
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: "RentCast Property API error",
      details: err.response?.data || err.message,
    });
  }
});

// 🔹 3. Random Property Generator
app.get("/random-property", async (req, res) => {
  try {
    const response = await axios.get("https://api.rentcast.io/v1/properties/random", {
      headers: {
        "X-Api-Key": process.env.RENTCAST_API_KEY,
      },
    });

    res.status(200).json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: "RentCast Random Property API error",
      details: err.response?.data || err.message,
    });
  }
});

// ✅ Server Listener
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RentCast proxy running on port ${PORT}`);
});
