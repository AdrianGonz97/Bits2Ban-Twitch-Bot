import type { Request, Response } from "express";
import logger from "$logger";
import ChatBotClient from "$class/ChatBotClient";
import { addListeners } from "$src/db/index";
import { User } from "$class/User";

export async function start(user: User) {
    logger.info(`Starting chatbot for [${user.login}]`);
    const client = new ChatBotClient(user);
    client.start();
    addListeners(client);
}

export async function stopBot(login: string) {
    const client = ChatBotClient.clients.get(login);
    if (!client) return;
    logger.warn(`Stopping chatbot for [${login}]`);
    client.stop();
}

export function getActiveClients(req: Request, res: Response) {
    const activeClients = [...ChatBotClient.clients.keys()];
    res.status(200).json({ activeClients, clientId: process.env.CLIENT_ID });
}
