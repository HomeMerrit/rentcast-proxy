const express = require("express");
const axios = require("axios");
const app = express();
require("dotenv").config();

app.use(express.json());

app.get("/rentcast", async (req, res) => {
  try {
    const response = await axios.get("https://api.rentcast.io/v1/avm/rent/long-term", {
      headers: {
        "X-Api-Key": process.env.RENTCAST_API_KEY,
      },
      params: req.query,
    });

    // Only return the key fields to avoid GPT response size limit
    const { rent, rentRangeLow, rentRangeHigh, confidenceScore } = response.data;

    res.status(200).json({
      rent,
      rentRangeLow,
      rentRangeHigh,
      confidenceScore
    });
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: "RentCast API error",
      details: err.response?.data || err.message,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RentCast proxy running on port ${PORT}`);
});
