https://vibe-routes-2fwe.vercel.app/

## LLM configuration

Set provider credentials in the deployment environment (or your shell), not in a
local `.env` file:

- `LLM_PROVIDER`: preferred model provider — `groq` (default), `gemini`, or `nvidia`. If it does not answer within 60s (or errors), the app switches to the next one in the order Groq → Gemini → NVIDIA and shows the switch in the UI.
- `LLM_SWITCH_TIMEOUT_MS`: optional override for that 60s timer (milliseconds).
- `NVIDIA_API_KEY` and optionally `NVIDIA_MODEL`
- `GROQ_API_KEY` and optionally `GROQ_MODEL`
- `GEMINI_API_KEY`

NVIDIA and Groq fall back to each other when a request fails. Gemini is tried
when the selected provider and its OpenAI-compatible fallback both fail.
Provider requests time out after 30 seconds, and itinerary responses are capped
at 4,096 tokens to keep generation responsive.
