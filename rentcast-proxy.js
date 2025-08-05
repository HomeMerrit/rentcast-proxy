// RentCast Proxy Server for Home Merrit
const express = require("express");
const axios = require("axios");
const app = express();
require("dotenv").config();

app.use(express.json());

// 🔹 1. Rent Estimate Endpoint
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

// 🔹 2. Property Details Endpoint (APN + Legal Description + Owner Name etc.)
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

    const {
      assessorID,
      legalDescription,
      owner,
      yearBuilt,
      bedrooms,
      bathrooms,
      squareFootage,
      propertyType,
      address,
      city,
      state,
      zipCode,
      taxAssessments,
      propertyTaxes,
      lotSize
    } = property;

    const taxYear = "2023";
    const assessedValue = taxAssessments?.[taxYear]?.value || "";
    const annualTaxes = propertyTaxes?.[taxYear]?.total || "";
    const taxRate = assessedValue && annualTaxes ? (annualTaxes / assessedValue).toFixed(4) : "";

    res.status(200).json({
      assessorID: assessorID || "TBD by title agency",
      legalDescription: legalDescription || "TBD by title agency",
      SellersFullName: owner?.names?.[0] || "TBD by title agency",
      YearBuilt: yearBuilt,
      Bedrooms: bedrooms,
      Bathrooms: bathrooms,
      SquareFootage: squareFootage,
      PropertyType: propertyType,
      FullAddress: address,
      City: city,
      State: state,
      Zip: zipCode,
      AssessedValue: assessedValue,
      AnnualTaxes: annualTaxes,
      TaxRate: taxRate,
      LotSize: lotSize,
    });
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: "RentCast Property API error",
      details: err.response?.data || err.message,
    });
  }
});

// ✅ Server Listener
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RentCast proxy running on port ${PORT}`);
});
