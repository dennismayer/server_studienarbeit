const SERVER_URL = "http://127.0.0.1:8080";

const credentials = {
    email: "d@d.com",
    password: "d",
};

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
    console.log(`Deleting ${messages.length} message(s)...`);

    // --- Delete every message -------------------------------------------
    for (const message of messages) {
        const deleteResponse = await fetch(`${SERVER_URL}/api/messages`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                Cookie: cookieHeader,
            },
            body: JSON.stringify({ id: message.id }),
        });

        if (deleteResponse.ok) {
            console.log(`Message ${message.id} deleted.`);
        } else {
            console.error(
                `Failed to delete message ${message.id}:`,
                deleteResponse.status,
                await deleteResponse.text()
            );
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
