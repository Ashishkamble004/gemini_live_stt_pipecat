import {
  RTVIClient,
  RTVIClientOptions,
  RTVIEvent,
} from "@pipecat-ai/client-js";
import { WebSocketTransport } from "@pipecat-ai/websocket-transport";

type LogLevel = "info" | "warning" | "error";

const getApiBaseUrl = () => {
  const host = window.location.hostname;
  const port = window.location.port;
  const protocol = window.location.protocol;
  return `${protocol}//${host}${port ? `:${port}` : ""}`;
};

class WebsocketClientApp {
  private rtviClient: RTVIClient | null = null;
  private audioContext: AudioContext | null = null;
  private activeTab: string = "tts-llm-stt";
  
  // Chatbot UI elements
  private chatbotToggle: HTMLButtonElement | null = null;
  private chatbotWidget: HTMLElement | null = null;
  private chatbotClose: HTMLButtonElement | null = null;
  private connectBtnChat: HTMLButtonElement | null = null;
  private micButton: HTMLButtonElement | null = null;
  private statusDot: HTMLElement | null = null;
  private connectionStatus: HTMLElement | null = null;
  private statusText: HTMLElement | null = null;
  private apiKeyInput: HTMLInputElement | null = null;
  private botTypeRadios: NodeListOf<HTMLInputElement> | null = null;

  constructor() {
    this.setupDOMElements();
    this.setupEventListeners();
    this.loadDefaultConfiguration();
  }

  private setupDOMElements(): void {
    // Chatbot UI elements
    this.chatbotToggle = document.getElementById("chatbot-toggle") as HTMLButtonElement;
    this.chatbotWidget = document.getElementById("chatbot-widget") as HTMLElement;
    this.chatbotClose = document.getElementById("chatbot-close") as HTMLButtonElement;
    this.connectBtnChat = document.getElementById("connect-btn-chat") as HTMLButtonElement;
    this.micButton = document.getElementById("mic-button") as HTMLButtonElement;
    this.statusDot = document.getElementById("status-dot") as HTMLElement;
    this.connectionStatus = document.getElementById("connection-status") as HTMLElement;
    this.statusText = document.getElementById("status-text") as HTMLElement;
    this.apiKeyInput = document.getElementById("api-key-input") as HTMLInputElement;
    this.botTypeRadios = document.querySelectorAll('input[name="bot-type"]');
  }

  private setupEventListeners(): void {
    // Chatbot toggle
    this.chatbotToggle?.addEventListener("click", () => this.toggleChatbot());
    this.chatbotClose?.addEventListener("click", () => this.closeChatbot());
    
    // Connection button
    this.connectBtnChat?.addEventListener("click", () => this.toggleConnection());
    
    // Microphone button
    this.micButton?.addEventListener("click", () => this.toggleMicrophone());
    
    // Bot type selection
    this.botTypeRadios?.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        if (target.checked) {
          this.activeTab = target.value;
          this.log(`Selected bot type: ${this.activeTab}`);
        }
      });
    });
  }

  private toggleChatbot(): void {
    this.chatbotWidget?.classList.toggle("active");
    this.chatbotToggle?.classList.toggle("active");
    
    if (this.chatbotWidget?.classList.contains("active")) {
      this.log("Chatbot opened");
    } else {
      this.log("Chatbot closed");
    }
  }

  private closeChatbot(): void {
    this.chatbotWidget?.classList.remove("active");
    this.chatbotToggle?.classList.remove("active");
    this.log("Chatbot closed");
  }

  private async loadDefaultConfiguration(): Promise<void> {
    try {
      const response = await fetch(`${getApiBaseUrl()}/system-prompt`);
      const data = await response.json();
      this.log("Default configuration loaded");
      // Store system prompt for later use
      (window as any).systemPrompt = data.system_prompt;
    } catch (error) {
      this.log(`Error loading configuration: ${error}`, "error");
    }
  }

  private log(message: string, level: LogLevel = "info"): void {
    console.log(`[${level.toUpperCase()}] ${message}`);
  }

  private updateConnectionStatus(status: "connected" | "connecting" | "disconnected"): void {
    if (this.statusDot) {
      if (status === "connected") {
        this.statusDot.classList.add("connected");
        if (this.connectionStatus) this.connectionStatus.textContent = "Connected";
      } else {
        this.statusDot.classList.remove("connected");
        if (this.connectionStatus) this.connectionStatus.textContent = status === "connecting" ? "Connecting..." : "Not Connected";
      }
    }
  }

  private updateStatusText(text: string): void {
    if (this.statusText) {
      this.statusText.textContent = text;
    }
  }

  private toggleConnection(): void {
    if (this.rtviClient) {
      this.disconnect();
    } else {
      this.connect();
    }
  }

  private toggleMicrophone(): void {
    if (!this.rtviClient) {
      this.log("Please connect first", "warning");
      return;
    }

    const tracks = this.rtviClient.tracks();
    if (tracks.local?.audio) {
      const isEnabled = tracks.local.audio.enabled;
      tracks.local.audio.enabled = !isEnabled;
      
      if (this.micButton) {
        if (!isEnabled) {
          this.micButton.classList.add("active");
          this.updateStatusText("Listening...");
        } else {
          this.micButton.classList.remove("active");
          this.updateStatusText("Microphone muted");
        }
      }
      
      this.log(isEnabled ? "Microphone muted" : "Microphone unmuted");
    }
  }

  private setupMediaTracks(): void {
    if (!this.rtviClient) return;
    const tracks = this.rtviClient.tracks();
    if (tracks.bot?.audio) {
      this.setupAudioTrack(tracks.bot.audio);
    }
  }

  private setupTrackListeners(): void {
    if (!this.rtviClient) return;

    this.rtviClient.on(RTVIEvent.TrackStarted, (track, participant) => {
      if (!participant?.local && track.kind === "audio") {
        this.setupAudioTrack(track);
        this.updateStatusText("Bot is speaking...");
      }
    });

    this.rtviClient.on(RTVIEvent.TrackStopped, (track, participant) => {
      if (!participant?.local && track.kind === "audio") {
        this.updateStatusText("Ready");
      }
    });
  }

  private setupAudioTrack(track: MediaStreamTrack): void {
    this.log("Setting up audio track");
    const audioEl = document.getElementById("bot-audio") as HTMLAudioElement;
    if (audioEl) {
      const stream = new MediaStream([track]);
      audioEl.srcObject = stream;
      audioEl.play().catch(e => this.log(`Audio play failed: ${e}`, "error"));
    }
  }

  public async connect(): Promise<void> {
    try {
      this.audioContext = new AudioContext();
      this.audioContext.resume();
      this.updateConnectionStatus("connecting");

      const transport = new WebSocketTransport();

      const apiKey = this.apiKeyInput?.value;

      if (!apiKey) {
        this.log("API key is required", "error");
        this.updateConnectionStatus("disconnected");
        this.updateStatusText("Please enter API key");
        return;
      }

      let connectUrl = `/connect?bot_type=${this.activeTab}&api_key=${apiKey}`;
      let systemInstructions = (window as any).systemPrompt || "";

      // Build connection URL based on active tab with default values
      if (this.activeTab === "tts-llm-stt") {
        connectUrl += `&tts_voice=en-US-Chirp3-HD-Aoede`;
        connectUrl += `&tts_pace=1.0`;
        connectUrl += `&llm_model=gemini-2.5-flash-lite-preview-06-17`;
        connectUrl += `&stt_model=chirp_3`;
        connectUrl += `&stt_language=en-IN`;
      } else {
        connectUrl += `&model=gemini-live-2.5-flash-preview`;
        connectUrl += `&voice=Custom-Female`;
        connectUrl += `&language=hi-IN`;
        connectUrl += `&tts=true`;
        connectUrl += `&tts_pace=1.0`;
      }

      if (systemInstructions) {
        connectUrl += `&system_instruction=${encodeURIComponent(systemInstructions)}`;
      }

      const RTVIConfig: RTVIClientOptions = {
        transport,
        params: {
          baseUrl: import.meta.env.VITE_WSS_URL || getApiBaseUrl(),
          endpoints: {
            connect: connectUrl,
          },
        },
        enableMic: true,
        enableCam: false,
        callbacks: {
          onConnected: () => {
            this.updateConnectionStatus("connected");
            this.updateStatusText("Connected! Click microphone to start");
            if (this.connectBtnChat) {
              this.connectBtnChat.innerHTML = '<i class="fas fa-plug"></i> Disconnect';
            }
            if (this.micButton) {
              this.micButton.disabled = false;
            }
          },
          onDisconnected: () => {
            this.updateConnectionStatus("disconnected");
            this.updateStatusText("Disconnected");
            if (this.connectBtnChat) {
              this.connectBtnChat.innerHTML = '<i class="fas fa-plug"></i> Connect';
            }
            if (this.micButton) {
              this.micButton.disabled = true;
              this.micButton.classList.remove("active");
            }
            this.log("Client disconnected");
          },
          onBotReady: (data) => {
            this.log(`Bot ready: ${JSON.stringify(data)}`);
            this.setupMediaTracks();
          },
          onGenericMessage: (message: any) => {
            if (message.type === "transcription") {
              const { participant, text } = message;
              this.log(`[${participant}] ${text}`, "info");
            }
          },
          onMessageError: (error) =>
            this.log(`Message error: ${error}`, "error"),
          onError: (error) => this.log(`Error: ${error}`, "error"),
        },
      };

      this.rtviClient = new RTVIClient(RTVIConfig);
      this.setupTrackListeners();

      this.log("Initializing devices...");
      await this.rtviClient.initDevices();

      const localTracks = this.rtviClient.tracks().local;
      if (localTracks?.audio) {
        localTracks.audio.enabled = false;
        this.log("Microphone muted by default");
      }

      this.log("Connecting to bot...");
      await this.rtviClient.connect();
    } catch (error) {
      this.log(`Error connecting: ${(error as Error).message}`, "error");
      this.updateConnectionStatus("disconnected");
      this.updateStatusText("Connection failed");
      if (this.rtviClient) {
        try {
          await this.rtviClient.disconnect();
        } catch (disconnectError) {
          this.log(`Error during disconnect: ${disconnectError}`, "error");
        }
      }
    }
  }

  public async disconnect(): Promise<void> {
    if (this.rtviClient) {
      try {
        await this.rtviClient.disconnect();
        this.rtviClient = null;
        if (this.audioContext) {
          this.audioContext.close();
          this.audioContext = null;
        }
      } catch (error) {
        this.log(`Error disconnecting: ${(error as Error).message}`, "error");
      }
    }
  }
}

declare global {
  interface Window {
    WebsocketClientApp: typeof WebsocketClientApp;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.WebsocketClientApp = WebsocketClientApp;
  const app = new WebsocketClientApp();
});
