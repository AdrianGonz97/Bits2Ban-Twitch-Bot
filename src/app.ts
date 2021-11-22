/* eslint-disable import/first */
/* eslint-disable import/order */
import dotenv from "dotenv";
import "module-alias/register";

dotenv.config();

import express from "express";
import logger from "$logger";
import auth from "$src/api/oauth/auth/index";
import { getActiveClients } from "$src/chatbot/index";

const app = express();

app.use(express.json());
app.use(express.static(`${__dirname}/pages`));
app.post("/auth", auth);
app.get("/clients", getActiveClients);

app.listen(process.env.PORT, () => logger.info(`Running on port ${process.env.PORT}`));
