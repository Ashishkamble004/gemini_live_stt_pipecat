import os
import websockets
from typing import Optional
from loguru import logger
from fastapi import WebSocket
from datetime import datetime

from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext
from pipecat.services.gemini_multimodal_live.gemini import (
    GeminiMultimodalLiveLLMService,
    InputParams,
    GeminiMultimodalModalities,
)
from pipecat.transports.network.fastapi_websocket import FastAPIWebsocketParams, FastAPIWebsocketTransport
from pipecat.services.google.tts import GoogleTTSService
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.serializers.protobuf import ProtobufFrameSerializer
from pipecat.frames.frames import Frame, StartInterruptionFrame, CancelFrame
from pipecat.transcriptions.language import Language
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.adapters.schemas.tools_schema import AdapterType, ToolsSchema
from pipecat.services.llm_service import FunctionCallParams
from system_prompt import SYSTEM_PROMPT

SYSTEM_INSTRUCTION = SYSTEM_PROMPT

class CustomProtobufSerializer(ProtobufFrameSerializer):
    async def serialize(self, frame: Frame) -> bytes | None:
        if isinstance(frame, (StartInterruptionFrame, CancelFrame)):
            return None  # Don't serialize these frames
        data = await super().serialize(frame)
        if isinstance(data, str):
            return data.encode("utf-8")
        return data

async def get_current_time(params: FunctionCallParams):
    await params.result_callback(
        {"time": datetime.now().strftime("%A, %B %d, %Y %I:%M %p")}
    )

async def run_agent_live(
    websocket: WebSocket,
    api_key: str,
    model: str,
    voice: Optional[str],
    language: str,
    system_instruction: Optional[str] = None,
    tts: bool = True,
    tts_pace: float = 0.80,
):
    if not api_key:
        raise ValueError("Google API key is required")

    gender = "female"
    if voice == "Custom-Male":
        gender = "male"

    system_prompt = SYSTEM_PROMPT.replace("female", gender)

    language_map = {
        "en-US": Language.EN_US,
        "en-GB": Language.EN_GB,
        "en-IN": Language.EN_IN,
        "es-ES": Language.ES_ES,
        "fr-FR": Language.FR_FR,
        "hi-IN": Language.HI_IN,
    }
    pipecat_language = language_map.get(language, Language.EN_US)
    transport = FastAPIWebsocketTransport(
        websocket,
        params=FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            add_wav_header=False,
            vad_analyzer=SileroVADAnalyzer(),
            serializer=CustomProtobufSerializer(),
        )
    )

    time_function = FunctionSchema(
        name="get_current_time",
        description="Get the current time.",
        properties={},
        required=[],
    )

    search_tool = {"google_search": {}}

    tools = ToolsSchema(
        standard_tools=[time_function],
        custom_tools={AdapterType.GEMINI: [search_tool]},
    )

    if tts:
        if voice == "Custom-Male":
            voice_key_path = os.getenv("CLONE_TTS_VOICE_KEY_MALE")
            if not voice_key_path:
                raise ValueError("CLONE_TTS_VOICE_KEY_MALE environment variable not set")
            with open(voice_key_path, "r") as f:
                key = f.read()
            # For cloned voices, use en-US as the base language code
            # The voice cloning will handle the accent/style
            tts_service = GoogleTTSService(
                voice_cloning_key=key,
                params=GoogleTTSService.InputParams(
                    language=Language.EN_US,
                    speaking_rate=tts_pace
                )
            )
        elif voice == "Custom-Female":
            voice_key_path = os.getenv("CLONE_TTS_VOICE_KEY_FEMALE")
            if not voice_key_path:
                raise ValueError("CLONE_TTS_VOICE_KEY_FEMALE environment variable not set")
            with open(voice_key_path, "r") as f:
                key = f.read()
            # For cloned voices, use en-US as the base language code
            # The voice cloning will handle the accent/style
            tts_service = GoogleTTSService(
                voice_cloning_key=key,
                params=GoogleTTSService.InputParams(
                    language=Language.EN_US,
                    speaking_rate=tts_pace
                )
            )
        else:
            tts_service = GoogleTTSService(
                voice_id=f"{language}-Chirp3-HD-{voice}",
                params=GoogleTTSService.InputParams(
                    language=pipecat_language,
                    speaking_rate=tts_pace
                )
            )

        llm = GeminiMultimodalLiveLLMService(
            api_key=api_key,
            model=f"models/{model}",
            system_instruction=system_instruction or system_prompt,
            tools=tools,
            transcribe_model_audio=True,
            params=InputParams(
                language=pipecat_language,
                modalities=GeminiMultimodalModalities.TEXT,  # Ensure text-only output
            )
        )
    else:
        params = {
            "api_key": api_key,
            "model": f"models/{model}",
            "system_instruction": system_prompt,
            "language": pipecat_language,
            "tools": tools,
            "transcribe_model_audio": True,
        }
        if voice and not tts:
            params["voice_id"] = voice
        llm = GeminiMultimodalLiveLLMService(**params)
        tts_service = None

    llm.register_function("get_current_time", get_current_time)

    context = OpenAILLMContext(
        [
            {
                "role": "user",
                "content": system_instruction or system_prompt,
            }
        ],
    )

    context_aggregator = llm.create_context_aggregator(context)

    pipeline_processors = [
        transport.input(),
        context_aggregator.user(),
        llm,  # LLM
    ]

    if tts_service:
        pipeline_processors.append(tts_service)

    pipeline_processors.extend([
        transport.output(),
        context_aggregator.assistant(),
    ])

    pipeline = Pipeline(pipeline_processors)

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
    )

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Pipecat Client connected")
        await task.queue_frames([context_aggregator.user().get_context_frame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info("Pipecat Client disconnected")
        await task.cancel()

    runner = PipelineRunner(handle_sigint=False)
    await runner.run(task)
