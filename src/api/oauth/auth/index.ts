import logger from "../../../logger/index";
import type { Request, Response } from "express";
import getUserInfo from "../_user";
import revoke from "../revoke/index";
import { oauth } from "../_oauth";
import { addUser, removeUser } from "../../../db/index";
import { start } from "../../bot/index";

type Body = {
    code: string;
    isRevoking: boolean;
};

export default async function post(req: Request, res: Response) {
    logger.info("Getting access token");
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const basePath = process.env.URI;

    const { code, isRevoking } = req.body as Body;

    const urlParams = new Map();
    const headers = { Accept: "application/json" };
    urlParams.set("client_id", clientId);
    urlParams.set("client_secret", clientSecret);
    urlParams.set("code", code);
    urlParams.set("grant_type", "authorization_code");
    urlParams.set("redirect_uri", `${basePath}/login`);

    try {
        const resp = await oauth("token", headers, null, urlParams);
        if (resp.status < 200 || resp.status > 299)
            throw new Error(`Failed to authorize with Twitch Status: ${resp.status}`);

        const userToken = resp.data as common.Token;

        const userData = await getUserInfo(userToken.access_token);
        if (userData) {
            const token = {
                ...userToken,
                ...userData,
            };

            if (isRevoking) {
                await revoke(token);
            } else {
                // runs only during normal auth to avoid writing/removing ops
                removeUser(token.login);
                addUser(token);
                // starts bot here to avoid login injection
                await start(token.access_token, token.login);
            }

            res.status(201).json({ message: "success" });
        } else throw new Error("Authorization failed");
    } catch (err: any) {
        logger.error(err);
        res.status(500).json({ message: err.message });
    }
}
