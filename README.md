**Real-Time Voice-to-Voice bot using Google's AI & Pipecat orchestration**

![alt text](https://img.shields.io/badge/License-MIT-yellow.svg)

This project demonstrates a real-time, voice-to-voice AI assistant using Google's AI models with Pipecat's WebSocket transport. It features a Python FastAPI backend and a TypeScript/Vite frontend with a modern chatbot interface.

The application captures audio from the user's microphone, streams it to the server for transcription, processes it with a LLM, generates a spoken response with text-to-speech, and streams the audio back to the client for playback—all in real time.

Two flows available:
- Live API flow (with standard voices and cloned voice via Chirp 3 HD TTS)
- STT + LLM + TTS flow (with standard voices and cloned voice via Chirp3 HD TTS)

Learn about instant custom clone voice here - https://cloud.google.com/text-to-speech/docs/chirp3-instant-custom-voice

**New Chatbot Interface**

The application now features a professional, SBI-inspired design with a chatbot widget in the bottom-right corner. Users can:
- Toggle the chatbot interface with a single click
- Select between STT-LLM-TTS and Gemini Live workflows using radio buttons
- Enter their Google API key securely
- Connect and start voice conversations with visual feedback
- Control the microphone with an intuitive button interface

**Architecture**

The client-side UI captures microphone audio and establishes a WebSocket connection with the Pipecat server. The server manages the real-time pipeline, integrating with third-party AI services for transcription, language modeling, and speech synthesis.

![alt text](./architecture.jpeg)

Features
- **Modern Chatbot Interface**: Professional SBI-inspired design with a floating chatbot widget
- **Dual Workflow Selection**: Choose between STT-LLM-TTS or Gemini Live via radio buttons
- Real-Time Transcription: Captures user audio and transcribes it live.
- LLM Integration: Processes transcribed text with a configurable large language model.
- Low-Latency Text-to-Speech (TTS): Generates and streams synthesized voice back to the client with minimal delay.
- Voice Cloning: Utilizes voice IDs to generate responses in specific cloned voices.
- Scalable Backend: Built with FastAPI, suitable for production workloads.
- Modern Frontend: Clean user interface built with TypeScript and Vite.
- Cloud-Ready: Includes a complete guide for deploying to Google Cloud Run with Docker and Secret Manager.

**Prerequisites**

- Python 3.8+
- Node.js and npm (v18+)
- Google Cloud SDK - genai
- GCP project API keys for AI services including Gemini.


Follow these steps to set up and run the project on your local machine.

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/pipecat-websocket-demo.git
cd pipecat-websocket-demo
```

### 2. Configure the Backend

The backend server handles the core AI pipeline.

1.  **Navigate to the server directory:**
    ```bash
    cd server
    ```

2.  **Create and activate a virtual environment:**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    # On Windows, use: venv\Scripts\activate
    ```

3.  **Install Python dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Set up your environment variables:**
    Copy the example file and add your secret keys.
    ```bash
    cp .env.example .env
    ```
    Now, edit the `.env` file with your credentials. This is where you'll add your API keys and the voice IDs for voice cloning.

    **.env**
    ```env
    # Example .env file
    GEMINI_API_KEY="your_gemini_api_key"
    # Voice IDs from your TTS provider (Chirp3 HD)
    VOICE_ID_FEMALE="path_to_your_female_voice_key"
    VOICE_ID_MALE="path_to_your_male_voice_key"
    ```
    Finally for local development on your laptop, authenticate to Google cloud using:
   
    ```
    gcloud auth application-default login

    ```
    
### 3. Run the Application

1.  **Start the backend server:**
    Make sure you are in the `server` directory with your virtual environment active.
    ```bash
    python server.py
    ```
    The server will start on `http://localhost:7860`. (Do not OPEN THIS IN BROWSER. This is only running server)

2.  **Run the frontend client:**
    Open a **new terminal window**.
    ```bash
    cd client
    npm install
    npm run dev
    ```
    The client will be accessible at the URL provided by Vite (usually `http://localhost:5173`). Open this URL in your browser to start using the voice assistant.

## Deployment to Google Cloud Run

This project is configured for easy deployment as a single container on Google Cloud Run. The `Dockerfile` builds the frontend assets and serves them from the Python backend.

### 1. Secret Management (Optional but definitely recommended for production workloads)

Do not hardcode your API keys. Use Google Secret Manager to store them securely.
Note: Pipecat shortly will integrate GCP Vertex AI platform. Post that, use Live API through vertex endpoint only.

```bash
# Set your GCP Project ID
export PROJECT_ID="your-gcp-project-id"
gcloud config set project $PROJECT_ID
```

### 2. Deploy to Cloud Run

From the root directory of the project, run the following command.
This command builds the container from the Dockerfile and deploys it.
Replace <your-service-name>, <your-region>, and <your-gcp-project> with your specific values.
code

```bash
gcloud run deploy <your-service-name> \
  --source . \
  --platform managed \
  --region <your-region> \
  --allow-unauthenticated \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=<your-gcp-project>"
```

## Using the Chatbot Interface

Once the application is running, you'll see a clean landing page with a chatbot button in the bottom-right corner.

### Steps to use:
1. **Open the Chatbot**: Click the blue chatbot icon in the bottom-right corner
2. **Select Bot Type**: Choose between:
   - **STT-LLM-TTS Pipeline**: Full pipeline with Speech-to-Text, LLM processing, and Text-to-Speech
   - **Gemini Live API**: Direct integration with Gemini Live for real-time conversations
3. **Enter API Key**: Provide your Google API key in the input field
4. **Connect**: Click the "Connect" button to establish connection
5. **Start Talking**: Click the green microphone button to start speaking
6. **Stop**: Click the microphone again to mute

The chatbot widget shows:
- Connection status (red dot = disconnected, green dot = connected)
- Real-time status messages
- Microphone control with visual feedback

Once deployed, Google Cloud will provide a public URL to access your application.

**Contributing**

Contributions are welcome! Please feel free to submit a pull request or open an issue for bugs, feature requests, or improvements.

Fork the repository.
- Create your feature branch (git checkout -b feature/AmazingFeature).
- Commit your changes (git commit -m 'Add some AmazingFeature').
- Push to the branch (git push origin feature/AmazingFeature).
- Open a Pull Request. We will review and proceed.

**License**

This project is licensed under the MIT License. See the LICENSE file for details.
