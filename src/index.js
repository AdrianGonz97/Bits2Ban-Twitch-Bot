import express from "express";
import logger from "./logger/index.js";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.get("/", function (req, res) {
    res.sendFile(path.join(__dirname + "/pages/home/index.html"));
});
app.get("/login", function (req, res) {
    res.sendFile(path.join(__dirname + "/pages/login/index.html"));
});

app.listen(3000);
logger.info("Running on port 3000");
