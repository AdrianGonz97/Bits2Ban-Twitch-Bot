import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import logger from "./logger/index.js";
import auth from "./api/oauth/auth/index.js";
import { start, stop } from "./api/bot/index.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(__dirname + "/pages"));
app.post("/auth", auth);
app.post("/start", start);
app.post("/stop", stop);

app.listen(3000);
logger.info("Running on port 3000");
