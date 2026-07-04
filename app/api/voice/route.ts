import { NextRequest } from "next/server";
import OpenAI from "openai";
import { generateSentenceStream } from "@/app/lib/stream-buffer";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM";


export async function GET(req: NextRequest) {
    try {
        // Extract the message from the URL query string
        const url = new URL(req.url);
        const message = url.searchParams.get("message");

        if (!message) {
            return new Response("Message is required", { status: 400 });
        }
        
        // 1. Trigger the LLM stream
        const stream = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: message }],
            stream: true,
        });

        // Helper to extract string tokens from the OpenAI chunk objects
        async function* extractTokens() {
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || "";
                if (content) yield content;
            }
        }

        const sentenceStream = generateSentenceStream(extractTokens());

        // 2. Initialize the Web ReadableStream for audio playback
        const audioStream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const sentence of sentenceStream) {
                        console.log("Generating audio for:", sentence);

                        // Request the audio stream from ElevenLabs
                        const response = await fetch(
                            `https://api.openai.com/v1/audio/speech`,
                            {
                                method: "POST",
                                headers: {
                                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                    model: "tts-1",
                                    voice: "alloy",
                                    input: sentence
                                }),
                            }
                        )

                        if (!response.ok) {
                            throw new Error(`OpenAI TTS error: ${response.status}`);
                        }

                        // 5. Pipe the ElevenLabs audio chunk directly to the Next.js client
                        const reader = response.body?.getReader();
                        if (reader) {
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                // Enqueue the raw aduio bytes to the frontend
                                controller.enqueue(value);
                            }
                            reader.releaseLock();
                        }
                    }
                } catch (err) {
                    console.error("Audio generation error:", err);
                    controller.error(err);
                } finally {
                    // 6. Close the stream once the AI is done talking
                    controller.close();
                }
            },
        });

        // 7. Return the stream to the frontend as an audio file being downloaded in real-time
        return new Response(audioStream, {
            headers: { 
                "Content-Type": "audio/mpeg",
                "Transfer-Encoding": "chunked",
            },
        });

    } catch (error) {
        console.error("Pipeline Error:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}