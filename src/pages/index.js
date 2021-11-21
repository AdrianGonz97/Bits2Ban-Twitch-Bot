window.onload = async () => {
    // needs to be changed to user specific twitch app
    const clientId = "8nxu1pu09x07u2q5wufhx4qv7bmk30";
    const baseUrl = window.location.hostname;
    const state = generateState();
    const scopes = [
        "bits:read",
        "user:read:email",
        "channel:moderate",
        "chat:read",
        "chat:edit",
    ];

    window.localStorage.setItem("state", state);

    const loginUrl =
        `https://id.twitch.tv/oauth2/authorize` +
        `?client_id=${clientId}` +
        `&redirect_uri=https://${baseUrl}/login` +
        `&response_type=code` +
        `&scope=${scopes.join("+")}` +
        `&force_verify=true` +
        `&state=${state}`;

    const revokeUrl =
        `https://id.twitch.tv/oauth2/authorize` +
        `?client_id=${clientId}` +
        `&redirect_uri=https://${baseUrl}/revoke` +
        `&response_type=code` +
        `&scope=${scopes.join("+")}` +
        `&force_verify=true` +
        `&state=${state}`;

    const login = document.getElementById("login");
    const revoke = document.getElementById("revoke");

    login.href = loginUrl;
    revoke.href = revokeUrl;

    try {
        const resp = await fetch(`https://${baseUrl}/clients`);
        const { activeClients } = await resp.json();

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
};

function generateState() {
    const validChars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    let array = new Uint8Array(40);

    window.crypto.getRandomValues(array);
    array = array.map((x) => validChars.charCodeAt(x % validChars.length));

    const randomState = String.fromCharCode.apply(null, array);

    return randomState;
}
