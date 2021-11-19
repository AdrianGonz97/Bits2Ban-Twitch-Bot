import express from "express";
// import path from "path";
// import { fileURLToPath } from "url";
import logger from "./logger/index";
import auth from "./api/oauth/auth/index";
import revoke from "./api/oauth/revoke/index";
import { getActiveClients } from "./api/bot/index";

const app = express();
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(__dirname + "/pages"));
app.post("/auth", auth);
// app.get("/clients", getActiveClients);

app.listen(process.env.PORT);
logger.info(`Running on port ${process.env.PORT}`);
