const dotenv = require("dotenv");
dotenv.config();

const config = {
    port: process.env.PORT || process.env.port || 3000,
    mongodb_url: process.env.MONGODB_URL || process.env.mongodb_url,
    openai_api_key: process.env.OPENAI_API_KEY || process.env.openai_api_key,
};

module.exports = config;