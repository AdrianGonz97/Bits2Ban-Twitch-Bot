export default async function post(request) {
    logger.info("Validating access token");
    let jwt = request.locals.jwt || JSON.parse(request.body).jwt;
    let accessToken = getAccessToken(jwt);

    if (!accessToken) {
        // for when the jwt expires
        logger.info("Refreshing JWT");
        jwt = await refreshJWT(jwt); // use refresh token
        if (jwt) {
            accessToken = getAccessToken(jwt);
            if (!accessToken) {
                logger.warn("No access token found");
                return {
                    status: 401,
                    body: { message: "No access token provided" },
                };
            }
        } else {
            return { status: 401, body: { message: "Failed to refresh JWT" } };
        }
    }

    const headers = { Authorization: "Bearer " + accessToken };

    try {
        const resp = await fetch("https://id.twitch.tv/oauth2/validate", {
            headers,
        });

        if (resp.ok) {
            // token is validated
            const expiresIn = Date.now() + 60 * 60 * 1000;
            return {
                status: 200,
                body: { validUntil: expiresIn.toString(), jwt },
            };
        } else {
            logger.warn("Reseting cookies");
            return {
                status: resp.status,
                body: { validUntil: "0", jwt: "" },
            };
        }
    } catch (err) {
        logger.error(err.message);
        return { status: 404, body: err.message };
    }
}
