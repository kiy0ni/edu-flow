const axios = require("axios");

const apiClient = axios.create({
  baseURL: process.env.ECOLEDIRECTE_API_BASE_URL || "https://api.ecoledirecte.com",
  timeout: 5000
});

module.exports = apiClient;
