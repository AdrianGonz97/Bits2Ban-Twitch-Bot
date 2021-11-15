const login = document.createElement("a");
const scopes = ["bits:read", "user:read:email"];

login.href =
    "bits:read+channel:manage:redemptions+channel:read:redemptions+user:read:email";
