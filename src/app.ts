import express from "express";
import logger from "$src/logger/index";
import auth from "$src/api/oauth/auth/index";
import { getActiveClients } from "$src/chatbot/index";

const app = express();

app.use(express.json());
app.use(express.static(`${__dirname}/pages`));
app.post("/auth", auth);
app.get("/clients", getActiveClients);

app.listen(process.env.PORT, () => logger.info(`Running on port ${process.env.PORT}`));
