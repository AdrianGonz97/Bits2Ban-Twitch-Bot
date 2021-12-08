/* eslint-disable no-use-before-define */
/* eslint-disable no-restricted-syntax */
window.onload = async () => {
    const baseUrl = window.location.origin;
    let clientId;

    try {
        const resp = await fetch(`${baseUrl}/clients`);
        const { activeClients, clientId: id } = await resp.json();
        clientId = id;

        const clients = document.getElementById("clients");
        const title = document.getElementById("client-title");
        title.innerText = `Active Clients: ${activeClients.length}`;

        for (const client of activeClients) {
            const p = document.createElement("p");
            p.innerText = client;
            clients.appendChild(p);
        }
    } catch (err) {
        console.error(err);
    }

    const state = generateState();
    const scopes = [
        "bits:read",
        "user:read:email",
        "channel:moderate",
        "chat:read",
        "chat:edit",
        "whispers:read",
        "whispers:edit",
    ];

    window.localStorage.setItem("state", state);

    const loginUrl =
        `https://id.twitch.tv/oauth2/authorize` +
        `?client_id=${clientId}` +
        `&redirect_uri=${baseUrl}/login` +
        `&response_type=code` +
        `&scope=${scopes.join("+")}` +
        `&force_verify=true` +
        `&state=${state}`;

    const revokeUrl =
        `https://id.twitch.tv/oauth2/authorize` +
        `?client_id=${clientId}` +
        `&redirect_uri=${baseUrl}/revoke` +
        `&response_type=code` +
        `&scope=${scopes.join("+")}` +
        `&force_verify=true` +
        `&state=${state}`;

    const login = document.getElementById("login");
    const revoke = document.getElementById("revoke");

    login.href = loginUrl;
    revoke.href = revokeUrl;
};

function generateState() {
    const validChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    let array = new Uint8Array(40);

    window.crypto.getRandomValues(array);
    array = array.map((x) => validChars.charCodeAt(x % validChars.length));

    const randomState = String.fromCharCode.apply(null, array);

    return randomState;
}
