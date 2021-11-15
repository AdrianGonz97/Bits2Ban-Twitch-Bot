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
        body: JSON.stringify({ code }),
        headers: { "Content-Type": "application/json" },
    });
    const tokenData = await tokenResp.json();
    console.log(tokenData);

    const botResp = await fetch(`https://${window.location.hostname}/start`, {
        method: "POST",
        body: JSON.stringify(tokenData),
        headers: { "Content-Type": "application/json" },
    });
    const botData = await botResp.json();
    console.log(botData);
    // window.location = "/";
}
