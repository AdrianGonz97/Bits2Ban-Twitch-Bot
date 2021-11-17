import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import logger from "./logger/index.js";
import auth from "./api/oauth/auth/index.js";
import revoke from "./api/oauth/revoke/index.js";
import { getActiveClients } from "./api/bot/index.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(__dirname + "/pages"));
app.post("/auth", auth);
app.post("/revoke", revoke);
app.get("/clients", getActiveClients);

app.listen(process.env.PORT);
logger.info(`Running on port ${process.env.PORT}`);
