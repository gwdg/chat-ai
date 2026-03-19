import type { FrontConfig } from "./front.config";

export const config: FrontConfig = {
    "mode": "prod",
    "port": 7220,
    "backendPath": "/api",
    "modelsPath": "/models",
    "userDataPath": "/user",
    "titleGenerationModel": "meta-llama-3.1-8b-instruct",
    "memoryGenerationModel": "meta-llama-3.1-8b-instruct",
    "proposalGenerationModel": "qwen3-30b-a3b-instruct-2507",
    "modules": {
        "tools": true,
        "feedback": false,
        "choices": true
    },
    "default": {
        "model": {
            "id": "qwen3-30b-a3b-instruct-2507",
            "name": "Qwen 3 30B A3B Instruct 2507"
        },
        "messages": [
            { "role": "system", "content": "You are a helpful assistant" }
        ],
        "top_p": 0.05,
        "temperature": 0.0,
        "enable_tools": true,
        "tools": {
            "web_search": false,
            "image_generation": false,
            "image_modification": false,
            "audio_generation": false,
            "video_generation": false,
            "arcana": true,
            "mcp": false
        },

    },
    "announcement": ""
}
