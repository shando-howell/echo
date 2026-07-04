import { NextRequest } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: NextRequest) {
    try {
        // Extract the FormData sent from the frontend MediaRecorder
        const formData = await req.formData();
        const file = formData.get("file") as File;

        // Guard clause: Ensure the audio blob actually arrived
        if (!file) {
            return new Response(JSON.stringify({ error: "No audio file found"}), {
                status: 400,
                headers: {"Content-Type": "application/json"}
            });
        }

        // Send the raw file object to the Whisper model
        const transcription = await openai.audio.transcriptions.create({
            file: file,
            model: "whisper-1"
        });

        console.log("Transcribed User Audio:", transcription.text);

        // Return the transcribed text string back to the Next.js client
        return new Response(JSON.stringify({ text: transcription.text }), {
            status: 200,
            headers: {"Content-Type": "application/json"}
        });
    } catch (error) {
        console.error("Transcription pipeline error:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
