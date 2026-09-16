# Free Tier AI API Providers

If you are looking to build or expand the AI capabilities of this application without incurring API costs, the following cloud API providers offer **perpetual free tiers** (where limits refresh daily or monthly, unlike one-time trial credits).

These are ideal alternatives or fallbacks to the current Google Gemini (Free Tier) and Ollama (Local/100% Free) setup.

---

### 1. Groq (The Speed King)
Groq uses custom hardware (LPUs instead of GPUs) and provides arguably the fastest inference on the market.
* **The Free Tier**: A generous free tier that refreshes daily. You get around **14,000 requests per day** and massive token limits.
* **Models Included**: Open-source powerhouses like `Llama 3.1` (70B & 8B), `Mixtral 8x7B`, and `Gemma`.
* **Best for**: Fast chat responses, real-time generation, and fast text chunking.
* **Documentation**: [https://console.groq.com/docs/quickstart](https://console.groq.com/docs/quickstart)

### 2. Cohere (The RAG Specialist)
Cohere is highly respected for its enterprise RAG pipelines, text-embedding capabilities, and re-ranking models.
* **The Free Tier**: A permanent "Developer Tier" that is **100% free forever** for non-production use. It grants up to **100 API calls per minute** and 1,000 calls per month.
* **Models Included**: `Command R`, `Command R+`, and excellent Embedding/Reranking models.
* **Best for**: Advanced RAG applications, text classification, semantic search, and improving chunk retrieval accuracy.
* **Documentation**: [https://docs.cohere.com/](https://docs.cohere.com/)

### 3. GitHub Models
GitHub recently released a new Playground and API for developers to test and build with models for free, leveraging Azure's infrastructure.
* **The Free Tier**: Generous daily limits (e.g., 50 requests per day for high-tier models, 150 for smaller models).
* **Models Included**: `GPT-4o`, `GPT-4o-mini`, `Llama 3.1`, `Phi-3`, `Mistral`.
* **Best for**: Accessing OpenAI's flagship models (`GPT-4o`) for free without paying OpenAI directly, great for high-quality note synthesis.
* **Documentation**: [https://docs.github.com/en/github-models](https://docs.github.com/en/github-models)

### 4. Mistral AI (Experimental Tier)
Mistral is a strong European competitor offering efficient, highly-performant open-weights models.
* **The Free Tier**: You can process up to **~1 Billion tokens per month** completely free on their "Experimental" tier.
* **The Catch**: Your requests are rate-limited to about 1 request per second.
* **Models Included**: `Mistral NeMo`, `Mistral Small`, `Codestral`.
* **Best for**: Background tasks like note generation or chunking where slight latency is acceptable.
* **Documentation**: [https://docs.mistral.ai/](https://docs.mistral.ai/)

### 5. Cloudflare Workers AI
For those already using the Cloudflare ecosystem, they have a built-in serverless AI router.
* **The Free Tier**: **10,000 requests per day** completely free.
* **Models Included**: Mostly open-source models like `Llama 3`, `Qwen`, and `DeepSeek Coder`.
* **Best for**: Serverless architectures and edge-deployed AI endpoints.
* **Documentation**: [https://developers.cloudflare.com/workers-ai/](https://developers.cloudflare.com/workers-ai/)

### 6. OpenRouter (The Aggregator)
OpenRouter is a unified API gateway (one API key to access 100+ models).
* **The Free Tier**: They host several "Free" models (like `Llama 3` and `Gemma`) completely free of charge. You get a baseline of about **50 to 200 requests per day**.
* **Best for**: App testing and benchmarking. Because they offer a standardized API, you can swap between 100 different AI models just by changing the model string name in your code!
* **Documentation**: [https://openrouter.ai/docs](https://openrouter.ai/docs)

---

## Current App Ecosystem Status

The app currently uses a dual-system approach to ensure zero costs:
1. **Google Gemini (Default)**: Uses Google AI Studio's free tier for high-quality, long-context processing (e.g., `gemini-flash-latest` and `text-embedding-004`).
2. **Ollama (Fallback)**: Uses local hardware to run 100% free, private local models with zero rate limits. 

*If rate limits on Gemini become an issue, integrating **Groq** via `@langchain/groq` is highly recommended as a fast, free secondary cloud provider.*
