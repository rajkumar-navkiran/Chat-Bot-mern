const express = require("express");
const app = express();
const config = require("./config/config");
const cors = require("cors");
const bodyParser = require("body-parser");
const dbConnection = require("./config/dbConnection");
const { apiLogger, errorHandler, notFoundHandler, getLocalNetworkIps, getPublicIpAddress } = require("./config/configApiHandle");
const chatRouter = require("./routes/chat");

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

dbConnection.on("error", (err) => {
    console.log(err);
});

app.use(apiLogger);

app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Chatbot API is running"
    });
});

app.use("/api/chat", chatRouter);

// 404 for any unmatched route (must be after all routes)
app.use(notFoundHandler);

// Error handler must be last
app.use(errorHandler);

app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);
    const publicIp = getPublicIpAddress();
    publicIp.then((ip) => {
        console.log(`Your public IP address is: ${ip}`);
    });
    const lanIps = getLocalNetworkIps();
    if (lanIps.length) {
        console.log(`To see other devices' IPs in logs, call API from that device: http://${lanIps[0]}:${config.port}`);
    }
});

