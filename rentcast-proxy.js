// RentCast Proxy + Contract Forwarder for Home Merrit
const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();
const app = express();
app.use(cors());
app.use(express.json());

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

app.get("/rentcast-full", async (req, res) => {
  try {
    const address = req.query.address;
    if (!address) return res.status(400).json({ error: "Address is required" });
    const apiKey = process.env.RENTCAST_API_KEY;
    const headers = { "X-Api-Key": apiKey };

    const [rentResponse, valueResponse, propertyResponse] = await Promise.allSettled([
      axios.get("https://api.rentcast.io/v1/avm/rent/long-term", {
        headers, params: { address, compCount: req.query.compCount || 15, maxRadius: req.query.maxRadius || 5, daysOld: req.query.daysOld || 180 },
      }),
      axios.get("https://api.rentcast.io/v1/avm/value", {
        headers, params: { address, compCount: req.query.compCount || 15, maxRadius: req.query.maxRadius || 10, daysOld: req.query.daysOld || 365 },
      }),
      axios.get("https://api.rentcast.io/v1/properties", { headers, params: { address } }),
    ]);

    let rentData = rentResponse.status === "fulfilled" ? rentResponse.value.data : null;
    let valueData = valueResponse.status === "fulfilled" ? valueResponse.value.data : null;

    let propertyData = null;
    let zipCode = null;
    if (propertyResponse.status === "fulfilled") {
      const p = propertyResponse.value.data?.[0];
      if (p) {
        zipCode = p.zipCode;
        const ty = "2023";
        const av = p.taxAssessments?.[ty]?.value || "";
        const at = p.propertyTaxes?.[ty]?.total || "";
        const tr = av && at ? (at / av).toFixed(4) : "";
        propertyData = {
          SellersFullName: p.owner?.names?.[0] || "", OwnerNames: p.owner?.names || [], OwnerType: p.owner?.type || null,
          YearBuilt: p.yearBuilt, Bedrooms: p.bedrooms, Bathrooms: p.bathrooms,
          SquareFootage: p.squareFootage, PropertyType: p.propertyType,
          FullAddress: p.address, City: p.city, State: p.state, Zip: p.zipCode, County: p.county || "",
          AssessedValue: av, AnnualTaxes: at, TaxRate: tr, LotSize: p.lotSize,
          HOAFee: p.hoa?.fee || null, SaleHistory: p.history || [],
          LastSaleDate: p.lastSaleDate || null, LastSalePrice: p.lastSalePrice || null,
        };
      }
    }

    let marketData = null, saleListingData = null, rentalListingData = null;
    const round2 = [];
    round2.push(zipCode ? axios.get("https://api.rentcast.io/v1/markets", { headers, params: { zipCode, dataType: "All" } }).catch(() => null) : Promise.resolve(null));
    round2.push(axios.get("https://api.rentcast.io/v1/listings/sale", { headers, params: { address, status: "Active", limit: 1 } }).catch(() => null));
    round2.push(axios.get("https://api.rentcast.io/v1/listings/rental/long-term", { headers, params: { address, status: "Active", limit: 1 } }).catch(() => null));

    const [mktRes, saleRes, rentLRes] = await Promise.all(round2);
    if (mktRes?.data) marketData = mktRes.data;
    if (saleRes?.data?.length > 0) {
      const l = saleRes.data[0];
      saleListingData = { price: l.price, status: l.status, daysOnMarket: l.daysOnMarket, listingType: l.listingType, listedDate: l.listedDate, listingAgent: l.listingAgent || null, listingOffice: l.listingOffice || null, mlsName: l.mlsName || null, mlsNumber: l.mlsNumber || null };
    }
    if (rentLRes?.data?.length > 0) {
      const l = rentLRes.data[0];
      rentalListingData = { price: l.price, status: l.status, daysOnMarket: l.daysOnMarket, listingAgent: l.listingAgent || null, listingOffice: l.listingOffice || null, mlsNumber: l.mlsNumber || null };
    }

    let propertyStatus = "Off Market";
    if (saleListingData) propertyStatus = "On Market (For Sale)";
    else if (rentalListingData) propertyStatus = "Active Rental";

    let densityInfo = null;
    if (rentData?.comparables?.length > 0) {
      const comps = rentData.comparables;
      const dists = comps.map(c => c.distance).filter(d => d != null);
      const avg = dists.length > 0 ? dists.reduce((a, b) => a + b, 0) / dists.length : null;
      const max = dists.length > 0 ? Math.max(...dists) : null;
      const hm = comps.filter(c => c.distance != null && c.distance <= 0.5).length;
      const om = comps.filter(c => c.distance != null && c.distance <= 1).length;
      let dr; if (hm >= 5) dr = "Urban/Dense Suburban"; else if (om >= 5) dr = "Suburban"; else if (comps.length >= 5 && avg <= 3) dr = "Low-Density Suburban"; else if (comps.length >= 3) dr = "Semi-Rural"; else dr = "Rural";
      densityInfo = { totalCompsFound: comps.length, compsWithinHalfMile: hm, compsWithinOneMile: om, avgCompDistance: avg ? +avg.toFixed(2) : null, maxCompDistance: max ? +max.toFixed(2) : null, densityRating: dr };
    }

    res.status(200).json({ rent: rentData, value: valueData, property: propertyData, density: densityInfo, market: marketData, saleListing: saleListingData, rentalListing: rentalListingData, propertyStatus });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: "Full analysis error", details: err.response?.data || err.message });
  }
});

app.get("/property-details", async (req, res) => {
  try {
    const r = await axios.get("https://api.rentcast.io/v1/properties", { headers: { "X-Api-Key": process.env.RENTCAST_API_KEY }, params: req.query });
    const p = r.data?.[0];
    if (!p) return res.status(404).json({ error: "No property data found" });
    const ty = "2023", av = p.taxAssessments?.[ty]?.value || "", at = p.propertyTaxes?.[ty]?.total || "", tr = av && at ? (at / av).toFixed(4) : "";
    res.status(200).json({ SellersFullName: p.owner?.names?.[0] || "", OwnerNames: p.owner?.names || [], YearBuilt: p.yearBuilt, Bedrooms: p.bedrooms, Bathrooms: p.bathrooms, SquareFootage: p.squareFootage, PropertyType: p.propertyType, FullAddress: p.address, City: p.city, State: p.state, Zip: p.zipCode, County: p.county || "", AssessedValue: av, AnnualTaxes: at, TaxRate: tr, LotSize: p.lotSize, HOAFee: p.hoa?.fee || null });
  } catch (err) { res.status(err.response?.status || 500).json({ error: "Property API error", details: err.response?.data || err.message }); }
});

app.post("/contract", async (req, res) => {
  try {
    const { template, data } = req.body;
    if (!template || !data) return res.status(400).json({ error: "Missing template or data" });
    const url = process.env.ZAPIER_WEBHOOK_URL || "https://hooks.zapier.com/hooks/catch/14562781/u49dfh5";
    const r = await axios.post(url, { template, data }, { headers: { "Content-Type": "application/json" } });
    res.status(200).json({ status: "Contract forwarded successfully", zapierResponse: r.data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`RentCast proxy running on port ${PORT}`));
