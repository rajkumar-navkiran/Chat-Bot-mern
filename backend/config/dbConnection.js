const mongoose = require("mongoose");
const config = require("./config");

mongoose.connect(config.mongodb_url).then(() => {
    console.log("Connected to MongoDB");
}).catch((err) => {
    console.log(err);
});

module.exports = mongoose.connection;