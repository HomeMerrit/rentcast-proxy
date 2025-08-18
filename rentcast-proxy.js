// RentCast Proxy Server for Home Merrit
const express = require("express");
const axios = require("axios");
const app = express();
require("dotenv").config();

app.use(express.json());

// 🔹 1. Rent Estimate Endpoint
app.get("/rentcast", async (req, res) => {
  try {
    const response = await axios.get(
      "https://api.rentcast.io/v1/avm/rent/long-term",
      {
        headers: { "X-Api-Key": process.env.RENTCAST_API_KEY },
        params: req.query,
      }
    );

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

// 🔹 2. Property Details Endpoint (Flattened)
app.get("/property-details", async (req, res) => {
  try {
    const response = await axios.get("https://api.rentcast.io/v1/properties", {
      headers: { "X-Api-Key": process.env.RENTCAST_API_KEY },
      params: req.query,
    });

    const property = response.data?.[0];

    if (!property) {
      return res.status(404).json({ error: "No property data found" });
    }

    const taxYear = "2023";
    const assessedValue = property.taxAssessments?.[taxYear]?.value || "";
    const annualTaxes = property.propertyTaxes?.[taxYear]?.total || "";
    const taxRate =
      assessedValue && annualTaxes
        ? (annualTaxes / assessedValue).toFixed(4)
        : "";

    const flatData = {
      assessorID: property.assessorID || "TBD by title agency",
      legalDescription: property.legalDescription || "TBD by title agency",
      SellersFullName: property.owner?.names?.[0] || "TBD by title agency",
      YearBuilt: property.yearBuilt,
      Bedrooms: property.bedrooms,
      Bathrooms: property.bathrooms,
      SquareFootage: property.squareFootage,
      PropertyType: property.propertyType,
      FullAddress: property.address,
      City: property.city,
      State: property.state,
      Zip: property.zipCode,
      AssessedValue: assessedValue,
      AnnualTaxes: annualTaxes,
      TaxRate: taxRate,
      LotSize: property.lotSize,
    };

    res.status(200).json(flatData);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: "RentCast Property API error",
      details: err.response?.data || err.message,
    });
  }
});

// 🔹 3. Webhook Forwarding (Contract payloads → Zapier/Docupilot)
app.post("/webhook", async (req, res) => {
  try {
    console.log("📄 Received contract payload:", req.body);

    const forwardRes = await axios.post(
      "https://hooks.zapier.com/hooks/catch/14562781/u49dfh5", // or Docupilot target
      req.body,
      { headers: { "Content-Type": "application/json" } }
    );

    res.status(200).json({
      status: "Contract forwarded successfully",
      response: forwardRes.data,
    });
  } catch (err) {
    console.error("❌ Webhook forwarding error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Server Listener
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RentCast proxy running on port ${PORT}`);
});
