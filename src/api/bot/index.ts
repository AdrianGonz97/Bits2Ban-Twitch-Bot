import type { Request, Response } from "express";
import logger from "$logger";
import ChatBotClient from "$class/ChatBotClient";

export async function start(accessToken: string, login: string) {
    logger.info(`Starting chatbot for [${login}]`);
    const client = new ChatBotClient(accessToken, login);
    client.start();
}

export async function stopBot(login: string) {
    const client = ChatBotClient.clients.get(login);
    if (!client) return;
    logger.warn(`Stopping chatbot for [${login}]`);
    client.stop();
}

export function getActiveClients(req: Request, res: Response) {
    const activeClients = [...ChatBotClient.clients.keys()];
    res.status(200).json({ activeClients });
}
