"use client";

import { useState, useRef } from "react";

type AgentStatus = "idle" | "listening" | "thinking" | "speaking";

export default function VoiceAgentClient() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [isProcessing, setIsProcessing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Audio Playback Logic
  const playAgentResponse = (messageToProcess: string) => {
    setStatus("thinking");

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const encodedMessage = encodeURIComponent(messageToProcess);
    const streamUrl = `/api/voice?message=${encodedMessage}`;

    const audio = new Audio(streamUrl);
    audioRef.current = audio;

    audio.onplay = () => setStatus("speaking");
    audio.onended = () => setStatus("idle");
    audio.onerror = (e) => {
      console.error("Audio playback error:", e);
      setStatus("idle");
    };

    audio.play().catch((err) => {
      console.error("Playback failed to start:", err);
      setStatus("idle");
    });
  };

  // Standard input
  const handleSendText = () => {
    if (!input.trim()) return;
    playAgentResponse(input);
    setInput("");
  };
  
  // Voice Recording Logic
  const toggleRecording = () => {
    if (status === "listening") {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = async () => {
    // Guard clause
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Microphone access blocked. Ensure you are on localhost or HTTPS.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      }

      mediaRecorder.onstop = async () => {
        // Assemble the audo blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processUserVoice(audioBlob);
      };

      mediaRecorder.start();
      setStatus("listening");
    } catch (error) {
      console.error("Microphone access denied:", error);
      alert("Failed to access microphone. Check browser permissions.");
      setStatus("idle");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && status === "listening") {
      mediaRecorderRef.current.stop();
    }
  };

  const processUserVoice = async (audioBlob: Blob) => {
    setStatus("thinking");
    const formData = new FormData();
    formData.append("file", audioBlob, "user-audio.webm");

    try {
      // Send the audio to our STT backend
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const { text } = await response.json();
      console.log("Transcribed: ", text);

      if (text) {
        playAgentResponse(text);
      } else {
        setStatus("idle")
      }
    } catch (error) {
      console.error("Transcription failed", error);
      setStatus("idle");
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-zinc-700 text-white">
      <div className="w-full max-w-md flex flex-col gap-4 bg-zinc-900/50 p-8 rounded-2xl border border-zinc-800
      shadow-2xl backdrop-blur-sm">

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            Echo
          </h1>
          <p className="text-zinc-400 text-sm font-medium">Real-time Multimodal Interface</p>
        </div>

        {/* Dynamic Status Indicator */}
        <div className="flex flex-col items-center justify-center h-24 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
          {status === "idle" && <span className="text-zinc-500 font-medium">Ready</span>}
          {status === "listening" && (
            <div className="flex items-center gap-2 text-rose-400 font-medium">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse"></span>
              Listening...
            </div>
          )}

          {status === "thinking" && (
            <div className="flex items-center gap-2 text-cyan-400 font-medium">
              <span className="w-3 h-3 rounded-full bg-cyan-500 animate-bounce"></span>
              Processing Pipeline...
            </div>
          )}

          {status === "speaking" && (
            <div className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-6 rounded-full bg-emerald-500 animate-[pulse_1s_ease-in-out_infinite]"></span>
              <span className="w-1.5 h-8 rounded-full bg-emerald-400 animate-[pulse_1.2s_ease-in-out_infinite_0.2s]"></span>
              <span className="w-1.5 h-6 rounded-full bg-emerald-500 animate-[pulse_0.8s_ease-in-out_infinite_0.4s]"></span>
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-3">
          <textarea
            className="w-full p-4 rounded-xl bg-zinc-900 border-zinc-800 focus:outline-none 
            focus:ring-2 focus:ring-cyan-500/50 transition-all resize-none text-zinc-200 
            placeholder:text-zinc-600 shadow-inner"
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={status !== "idle"}
          />

          <div className="flex gap-2">
            <button 
              onClick={toggleRecording}
              disabled={status === "thinking" || status === "speaking"}
              className={`flex-1 py-3 px-4 rounded-xl font-sembold transition-all duration-200 flex
              items-center justify-center gap-2 ${
                status === "listening"
                   ? "bg-rose-500/20 text-rose-400 border border-rose-500/50 hover:bg-rose-500/30"
                   : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-transparent"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {status === "listening" ? "Stop Recording" : "Use Voice"}
            </button>
          </div>

          <button
            onClick={handleSendText}
            disabled={status !== "idle" || !input.trim()}
            className="flex-1 py-3 bg-linear-to-r from-blue-600 to-cyan-600 hover:fom-blue-500 
            hover:to-cyan-500 disabled:opacity-500 disabled:cursor-not-allowed rounded-xl 
            font-semibold transition-all shadow-lg shadow-cyan-900/20"
          >
            {isProcessing ? "Processing Stream..." : "Send"}
          </button>
        </div>
      </div>
    </main>
  );
}