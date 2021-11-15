export function generateState() {
    const validChars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    let array = new Uint8Array(40);

    window.crypto.getRandomValues(array);
    array = array.map((x) => validChars.charCodeAt(x % validChars.length));

    const randomState = String.fromCharCode.apply(null, array);

    return randomState;
}
