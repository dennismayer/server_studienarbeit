const SERVER_URL = "http://127.0.0.1:8080";

const credentials = {
    email: "d@d.com",
    password: "d",
};

// NOTE: POST /api/messages/:id/read (server.js) never sends a response on a
// successful update, only on error, so a plain fetch() would hang forever
// waiting for headers. This timeout works around that on the client side.
async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

// --- Login ---------------------------------------------------------------
console.log("Logging in as", credentials.email, "...");

const loginResponse = await fetch(`${SERVER_URL}/login`, {
    method: "POST",
    headers: {
        "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(credentials),
    redirect: "manual",
});

const setCookies = loginResponse.headers.getSetCookie();
const cookieHeader = setCookies.map((cookie) => cookie.split(";")[0]).join("; ");

if (!cookieHeader || loginResponse.headers.get("location") !== "/") {
    console.error("Login failed. Server redirected to:", loginResponse.headers.get("location"));
    process.exit(1);
}

console.log("Login successful.");

// --- Fetch messages --------------------------------------------------------
const messagesResponse = await fetch(`${SERVER_URL}/api/messages`, {
    method: "GET",
    headers: {
        Cookie: cookieHeader,
    },
});

if (messagesResponse.status === 204) {
    console.log("No messages found.");
} else if (messagesResponse.ok) {
    const messages = await messagesResponse.json();
    console.log(`Marking ${messages.length} message(s) as read...`);

    // --- Mark every message as read ----------------------------------
    for (const message of messages) {
        try {
            await fetchWithTimeout(`${SERVER_URL}/api/messages/${message.id}/read`, {
                method: "POST",
                headers: {
                    Cookie: cookieHeader,
                },
            });
            console.log(`Message ${message.id} marked as read.`);
        } catch (e) {
            if (e.name === "AbortError") {
                console.warn(`Message ${message.id}: no response from server before timeout (update likely still went through).`);
            } else {
                console.error(`Message ${message.id}: request failed:`, e.message);
            }
        }
    }
} else {
    console.error("Failed to fetch messages:", messagesResponse.status, await messagesResponse.text());
}

// --- Logout ----------------------------------------------------------------
console.log("Logging out...");

const logoutResponse = await fetch(`${SERVER_URL}/logout`, {
    method: "DELETE",
    headers: {
        Cookie: cookieHeader,
    },
    redirect: "manual",
});

if (logoutResponse.headers.get("location") === "/login") {
    console.log("Logout successful.");
} else {
    console.error("Logout may have failed. Status:", logoutResponse.status);
}
