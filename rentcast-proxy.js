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

    res.status(200).json(response.data);
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
