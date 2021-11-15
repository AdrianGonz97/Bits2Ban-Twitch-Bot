import express from "express";
import logger from "./logger/index.js";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(__dirname + "/pages"));

app.listen(3000);
logger.info("Running on port 3000");
