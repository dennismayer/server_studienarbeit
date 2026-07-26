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
    console.log("Messages:", messages);

    // --- Fetch audio URL for each message -----------------------------
    for (const message of messages) {
        console.log(`Fetching audio URL for message ${message.id}...`);

        const audioUrlResponse = await fetch(`${SERVER_URL}/api/messages/${message.id}/audio-url`, {
            method: "GET",
            headers: {
                Cookie: cookieHeader,
            },
        });

        if (audioUrlResponse.ok) {
            const audioUrlBody = await audioUrlResponse.json();
            console.log(`Audio URL for message ${message.id}:`, audioUrlBody.url);

            // check that the presigned URL actually allows downloading the file
            const downloadResponse = await fetch(audioUrlBody.url, { method: "GET" });

            if (downloadResponse.ok) {
                const audioBytes = await downloadResponse.arrayBuffer();
                console.log(`Audio file for message ${message.id} downloaded successfully (${audioBytes.byteLength} bytes).`);
            } else {
                console.error(
                    `Audio file for message ${message.id} could not be downloaded:`,
                    downloadResponse.status,
                    await downloadResponse.text()
                );
            }
        } else {
            console.error(
                `Failed to fetch audio URL for message ${message.id}:`,
                audioUrlResponse.status,
                await audioUrlResponse.text()
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
