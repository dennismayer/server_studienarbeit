import fs from "fs";

const SERVER_URL = "https://ostfalia-professorenhub.com";
const wave = fs.readFileSync(new URL("./file_example_WAV_1MG.wav", import.meta.url));

const mockMessages = [
    {
        user_id: 1,
        sender_name: "Anna Schmidt",
        message: "Guten Tag, ich hätte eine Frage zur Klausur.",
        audio_duration_s: 4,
        send_file: true,
    },
    {
        user_id: 1,
        sender_name: "Tim Weber",
        message: "Könnten wir den Sprechstundentermin verschieben?",
        audio_duration_s: 7,
        send_file: true,
    },
    {
        user_id: 1,
        sender_name: "Laura Fischer",
        message: "Vielen Dank für die schnelle Rückmeldung!",
        audio_duration_s: 3,
        send_file: true,
    },
    {
        user_id: 1,
        sender_name: "Jonas Becker",
        message: "Ich schicke Ihnen die Unterlagen noch einmal zu.",
        audio_duration_s: 6,
        send_file: true,
    },
    {
        user_id: 1,
        sender_name: "Sophie Wagner",
        message: "Ist das Büro am Freitag geöffnet?",
        audio_duration_s: 3,
        send_file: true,
    },
];

for (const mockMessage of mockMessages) {
    console.log(`Uploading message from "${mockMessage.sender_name}"...`);

    const response = await fetch(`${SERVER_URL}/api/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(mockMessage),
    });

    const responseBody = await response.json();

    if (!response.ok) {
        console.error("Failed to create message:", response.status, responseBody);
        continue;
    }

    const url = responseBody.url;

    if (url) {
        const audioResponse = await fetch(url, {
            method: "PUT",
            headers: {
                "Content-Type": "audio/wav",
            },
            body: wave,
        });

        if (!audioResponse.ok) {
            console.error("Failed to upload audio:", audioResponse.status);
            continue;
        }
    }

    console.log(`Message from "${mockMessage.sender_name}" uploaded successfully.`);
}

console.log("Done uploading mock messages.");
