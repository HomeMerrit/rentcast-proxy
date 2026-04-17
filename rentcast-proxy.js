// RentCast Proxy + Contract Forwarder for Home Merrit
const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();
const app = express();
app.use(cors());
app.use(express.json());

// 🔹 1. Rent Estimate Endpoint (FULL)
app.get("/rentcast", async (req, res) => {
  try {
    const params = { ...req.query };
    if (!params.compCount) params.compCount = 15;
    if (!params.maxRadius) params.maxRadius = 5;
    if (!params.daysOld) params.daysOld = 180;
    const response = await axios.get("https://api.rentcast.io/v1/avm/rent/long-term", {
      headers: { "X-Api-Key": process.env.RENTCAST_API_KEY }, params,
    });
    res.status(200).json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: "RentCast API error", details: err.response?.data || err.message });
  }
});

// 🔹 2. Full Analysis (rent + value + property + market + listings in one call)
app.get("/rentcast-full", async (req, res) => {
  try {
    const address = req.query.address;
    if (!address) return res.status(400).json({ error: "Address is required" });
    const apiKey = process.env.RENTCAST_API_KEY;
    const headers = { "X-Api-Key": apiKey };

    // First round: rent, value, property
    const [rentResponse, valueResponse, propertyResponse] = await Promise.allSettled([
      axios.get("https://api.rentcast.io/v1/avm/rent/long-term", {
        headers,
        params: { address, compCount: req.query.compCount || 15, maxRadius: req.query.maxRadius || 5, daysOld: req.query.daysOld || 180 },
      }),
      axios.get("https://api.rentcast.io/v1/avm/value", {
        headers,
        params: { address, compCount: req.query.compCount || 15, maxRadius: req.query.maxRadius || 10, daysOld: req.query.daysOld || 365 },
      }),
      axios.get("https://api.rentcast.io/v1/properties", {
        headers, params: { address },
      }),
    ]);

    let rentData = null;
    if (rentResponse.status === "fulfilled") rentData = rentResponse.value.data;

    let valueData = null;
    if (valueResponse.status === "fulfilled") valueData = valueResponse.value.data;

    let propertyData = null;
    let zipCode = null;
    if (propertyResponse.status === "fulfilled") {
      const property = propertyResponse.value.data?.[0];
      if (property) {
        zipCode = property.zipCode;
        const taxYear = "2023";
        const assessedValue = property.taxAssessments?.[taxYear]?.value || "";
        const annualTaxes = property.propertyTaxes?.[taxYear]?.total || "";
        const taxRate = assessedValue && annualTaxes ? (annualTaxes / assessedValue).toFixed(4) : "";
        propertyData = {
          assessorID: property.assessorID || "TBD by title agency",
          legalDescription: property.legalDescription || "TBD by title agency",
          SellersFullName: property.owner?.names?.[0] || "TBD by title agency",
          OwnerNames: property.owner?.names || [],
          OwnerType: property.owner?.type || null,
          YearBuilt: property.yearBuilt, Bedrooms: property.bedrooms, Bathrooms: property.bathrooms,
          SquareFootage: property.squareFootage, PropertyType: property.propertyType,
          FullAddress: property.address, City: property.city, State: property.state,
          Zip: property.zipCode, County: property.county || "",
          AssessedValue: assessedValue, AnnualTaxes: annualTaxes, TaxRate: taxRate,
          LotSize: property.lotSize,
          HOAFee: property.hoa?.fee || null,
          SaleHistory: property.history || [],
          Features: property.features || {},
          LastSaleDate: property.lastSaleDate || null,
          LastSalePrice: property.lastSalePrice || null,
        };
      }
    }

    // Second round: market data + sale listing + rental listing
    let marketData = null;
    let saleListingData = null;
    let rentalListingData = null;

    const secondRound = [];
    if (zipCode) {
      secondRound.push(
        axios.get("https://api.rentcast.io/v1/markets", {
          headers, params: { zipCode, dataType: "All" },
        }).catch(() => null)
      );
    } else {
      secondRound.push(Promise.resolve(null));
    }
    // Always search for sale and rental listings by address
    secondRound.push(
      axios.get("https://api.rentcast.io/v1/listings/sale", {
        headers, params: { address, status: "Active", limit: 1 },
      }).catch(() => null)
    );
    secondRound.push(
      axios.get("https://api.rentcast.io/v1/listings/rental/long-term", {
        headers, params: { address, status: "Active", limit: 1 },
      }).catch(() => null)
    );

    const [marketRes, saleListingRes, rentalListingRes] = await Promise.all(secondRound);

    if (marketRes && marketRes.data) marketData = marketRes.data;

    if (saleListingRes && saleListingRes.data && saleListingRes.data.length > 0) {
      const listing = saleListingRes.data[0];
      saleListingData = {
        price: listing.price,
        status: listing.status,
        daysOnMarket: listing.daysOnMarket,
        listingType: listing.listingType,
        listedDate: listing.listedDate,
        listingAgent: listing.listingAgent || null,
        listingOffice: listing.listingOffice || null,
        mlsName: listing.mlsName || null,
        mlsNumber: listing.mlsNumber || null,
      };
    }

    if (rentalListingRes && rentalListingRes.data && rentalListingRes.data.length > 0) {
      const listing = rentalListingRes.data[0];
      rentalListingData = {
        price: listing.price,
        status: listing.status,
        daysOnMarket: listing.daysOnMarket,
        listedDate: listing.listedDate,
        listingAgent: listing.listingAgent || null,
        listingOffice: listing.listingOffice || null,
        mlsNumber: listing.mlsNumber || null,
      };
    }

    // Determine property status
    let propertyStatus = "Off Market";
    if (saleListingData) propertyStatus = "On Market (For Sale)";
    else if (rentalListingData) propertyStatus = "Active Rental";

    // Density from rental comps
    let densityInfo = null;
    if (rentData && rentData.comparables && rentData.comparables.length > 0) {
      const comps = rentData.comparables;
      const distances = comps.map(c => c.distance).filter(d => d != null);
      const avgDistance = distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : null;
      const maxDistance = distances.length > 0 ? Math.max(...distances) : null;
      const compsWithinHalfMile = comps.filter(c => c.distance != null && c.distance <= 0.5).length;
      const compsWithinOneMile = comps.filter(c => c.distance != null && c.distance <= 1).length;
      let densityRating;
      if (compsWithinHalfMile >= 5) densityRating = "Urban/Dense Suburban";
      else if (compsWithinOneMile >= 5) densityRating = "Suburban";
      else if (comps.length >= 5 && avgDistance <= 3) densityRating = "Low-Density Suburban";
      else if (comps.length >= 3) densityRating = "Semi-Rural";
      else densityRating = "Rural";
      densityInfo = { totalCompsFound: comps.length, compsWithinHalfMile, compsWithinOneMile, avgCompDistance: avgDistance ? parseFloat(avgDistance.toFixed(2)) : null, maxCompDistance: maxDistance ? parseFloat(maxDistance.toFixed(2)) : null, densityRating };
    }

    res.status(200).json({
      rent: rentData,
      value: valueData,
      property: propertyData,
      density: densityInfo,
      market: marketData,
      saleListing: saleListingData,
      rentalListing: rentalListingData,
      propertyStatus: propertyStatus,
    });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: "RentCast Full Analysis error", details: err.response?.data || err.message });
  }
});

// 🔹 3. Property Details Endpoint
app.get("/property-details", async (req, res) => {
  try {
    const response = await axios.get("https://api.rentcast.io/v1/properties", {
      headers: { "X-Api-Key": process.env.RENTCAST_API_KEY }, params: req.query,
    });
    const property = response.data?.[0];
    if (!property) return res.status(404).json({ error: "No property data found" });
    const taxYear = "2023";
    const assessedValue = property.taxAssessments?.[taxYear]?.value || "";
    const annualTaxes = property.propertyTaxes?.[taxYear]?.total || "";
    const taxRate = assessedValue && annualTaxes ? (annualTaxes / assessedValue).toFixed(4) : "";
    res.status(200).json({
      assessorID: property.assessorID || "TBD by title agency", legalDescription: property.legalDescription || "TBD by title agency",
      SellersFullName: property.owner?.names?.[0] || "TBD by title agency",
      OwnerNames: property.owner?.names || [], OwnerType: property.owner?.type || null,
      YearBuilt: property.yearBuilt, Bedrooms: property.bedrooms, Bathrooms: property.bathrooms,
      SquareFootage: property.squareFootage, PropertyType: property.propertyType,
      FullAddress: property.address, City: property.city, State: property.state,
      Zip: property.zipCode, County: property.county || "",
      AssessedValue: assessedValue, AnnualTaxes: annualTaxes, TaxRate: taxRate, LotSize: property.lotSize,
      HOAFee: property.hoa?.fee || null, SaleHistory: property.history || [],
      Features: property.features || {},
      LastSaleDate: property.lastSaleDate || null, LastSalePrice: property.lastSalePrice || null,
    });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: "RentCast Property API error", details: err.response?.data || err.message });
  }
});

// 🔹 4. Contract Forwarding
app.post("/contract", async (req, res) => {
  try {
    const { template, data } = req.body;
    if (!template || !data) return res.status(400).json({ error: "Missing template or data" });
    const zapierWebhookUrl = process.env.ZAPIER_WEBHOOK_URL || "https://hooks.zapier.com/hooks/catch/14562781/u49dfh5";
    const forwardRes = await axios.post(zapierWebhookUrl, { template, data }, { headers: { "Content-Type": "application/json" } });
    res.status(200).json({ status: "Contract forwarded successfully", zapierResponse: forwardRes.data });
  } catch (err) {
    console.error("Contract forwarding error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`RentCast proxy running on port ${PORT}`));
