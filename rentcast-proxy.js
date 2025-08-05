const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

const RENTCAST_API_KEY = process.env.RENTCAST_API_KEY;

// 🔹 1. Long-term Rent Estimate
app.get("/rentcast", async (req, res) => {
  try {
    const response = await axios.get("https://api.rentcast.io/v1/avm/rent/long-term", {
      headers: {
        "X-Api-Key": RENTCAST_API_KEY,
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

// 🔹 2. Property Details (Comprehensive Info)
app.get("/property-details", async (req, res) => {
  try {
    const response = await axios.get("https://api.rentcast.io/v1/properties", {
      headers: {
        "X-Api-Key": RENTCAST_API_KEY,
      },
      params: req.query,
    });

    const property = response.data?.[0]; // RentCast returns an array

    if (!property) {
      return res.status(404).json({ error: "No property data found" });
    }

    const {
      formattedAddress,
      city,
      state,
      zipCode,
      assessorID,
      legalDescription,
      owner,
      ownerOccupied,
      propertyTaxes,
      taxAssessments,
      bedrooms,
      bathrooms,
      squareFootage,
      lotSize,
      yearBuilt,
      county,
      propertyType,
    } = property;

    res.status(200).json({
      formattedAddress,
      city,
      state,
      zipCode,
      assessorID,
      legalDescription,
      owner: owner?.names?.[0] || "TBD by title agency",
      ownerOccupied,
      propertyTaxes,
      taxAssessments,
      bedrooms,
      bathrooms,
      squareFootage,
      lotSize,
      yearBuilt,
      county,
      propertyType,
    });
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: "RentCast Property API error",
      details: err.response?.data || err.message,
    });
  }
});

// 🔹 3. Random Property Generator (Optional Tool)
app.get("/random-property", async (req, res) => {
  try {
    const response = await axios.get("https://api.rentcast.io/v1/properties/random", {
      headers: {
        "X-Api-Key": RENTCAST_API_KEY,
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

// ✅ Server Listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RentCast proxy running on port ${PORT}`);
});
