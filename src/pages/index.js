window.onload = function () {
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

    const url =
        `https://id.twitch.tv/oauth2/authorize` +
        `?client_id=${clientId}` +
        `&redirect_uri=https://${baseUrl}/login` +
        `&response_type=code` +
        `&scope=${scopes.join("+")}` +
        `&force_verify=true` +
        `&state=${state}`;

    const login = document.getElementById("login");
    login.href = url;
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
