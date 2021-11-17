const urlSearchParams = new URLSearchParams(window.location.search);
const params = Object.fromEntries(urlSearchParams.entries());

if (params.state === window.localStorage.getItem("state")) {
    // send code to server
    console.log("State is valid");
    sendCode(params.code);
} else {
    // redirect to error pages
    window.location = "error";
}

async function sendCode(code) {
    const tokenResp = await fetch(`https://${window.location.hostname}/auth`, {
        method: "POST",
        body: JSON.stringify({ code, isRevoking: true }),
        headers: { "Content-Type": "application/json" },
    });
    window.location = "/";
}
