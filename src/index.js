import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import logger from "./logger/index.js";
import auth from "./api/oauth/auth/index.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(bodyParser.json());
app.use(express.static(__dirname + "/pages"));
app.post("/auth", auth);

app.listen(3000);
logger.info("Running on port 3000");
