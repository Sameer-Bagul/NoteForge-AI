For your use case (**YouTube → Notes SaaS**), don't design around exact hardcoded limits because Google changes them periodically. Instead design around a **queue + rate limiter + retry system**.

According to Google's official documentation, Gemini rate limits are measured using:

* RPM = Requests Per Minute
* TPM = Tokens Per Minute
* RPD = Requests Per Day

Limits are applied per **Google AI Studio project**, not per API key. Multiple API keys under the same project do not increase quota. ([Google AI for Developers][1])

## Practical Free Tier Limits (2026)

The commonly reported limits for AI Studio free tier are approximately:

| Model                 | RPM | TPM       | RPD      |
| --------------------- | --- | --------- | -------- |
| Gemini 2.5 Pro        | 5   | 250,000   | 50-100   |
| Gemini 2.5 Flash      | 10  | 250,000   | 250-1500 |
| Gemini 2.5 Flash Lite | 15  | 250,000   | 1000+    |
| Gemini 2.0 Flash      | 15  | 1,000,000 | 1500     |

These numbers have changed multiple times during 2025-2026, so always verify inside AI Studio for your project. ([PE Collective][2])

---

# For Your YouTube Notes App

Assume:

### One Video Workflow

User pastes URL

1. Get transcript
2. Generate summary
3. Generate chapters
4. Generate key points
5. Generate flashcards
6. Generate quiz

Many developers do:

```txt
API Call 1
API Call 2
API Call 3
API Call 4
API Call 5
```

Bad idea.

---

## Better Approach

Single Gemini Call:

```json
{
  "summary": "...",
  "chapters": [],
  "keyPoints": [],
  "flashcards": [],
  "quiz": []
}
```

One request generates everything.

Benefits:

* Lower RPM
* Lower cost
* Faster
* Less chance of hitting limits

---

# Recommended Architecture

## Queue System

When user submits video:

```txt
PENDING
↓
PROCESSING
↓
COMPLETED
```

Store in MongoDB:

```js
{
  status: "pending"
}
```

Worker picks jobs.

---

## Rate Limiter

Use:

```bash
npm install bottleneck
```

Example:

```js
const limiter = new Bottleneck({
  minTime: 7000
});
```

This allows:

```txt
1 request every 7 seconds
```

≈ 8 requests/minute

Safe under free Flash limits.

---

# Retry System

When Gemini returns:

```txt
429 RESOURCE_EXHAUSTED
```

Retry:

```txt
5 sec
10 sec
20 sec
40 sec
```

Exponential backoff.

Never immediately retry.

Google specifically recommends handling rate-limit errors. ([Google AI for Developers][1])

---

# Token Planning

Typical transcript sizes:

| Video Length | Approx Tokens |
| ------------ | ------------- |
| 5 min        | 3k-5k         |
| 10 min       | 8k-12k        |
| 30 min       | 25k-40k       |
| 60 min       | 50k-80k       |

If you use Gemini Flash:

```txt
250,000 TPM
```

You could theoretically process:

```txt
3 to 5 one-hour videos
```

within a minute before TPM becomes the bottleneck. ([PE Collective][2])

---

# Free Tier SaaS Capacity

Let's estimate:

### One Video

Transcript:

```txt
15,000 tokens
```

Output:

```txt
5,000 tokens
```

Total:

```txt
20,000 tokens
```

250,000 TPM ÷ 20,000

≈

```txt
12 videos/minute
```

Token-wise.

But RPM hits first.

Flash:

```txt
10 requests/minute
```

So realistically:

```txt
8-10 videos/minute
```

on free tier.

---

# Paid Tier

Once billing is enabled, limits jump dramatically.

Typical Tier-1 paid accounts get roughly:

| Model      | RPM  |
| ---------- | ---- |
| Flash      | 300+ |
| Flash Lite | 300+ |
| Pro        | 150+ |

with much larger TPM allowances. ([AI Free API][3])

At that point rate limiting is rarely an issue for a small SaaS.

---

# Architecture I Would Use

For your stack (Next.js + Node + MongoDB):

### User Request

```txt
User submits YouTube URL
```

↓

### Backend

```txt
Extract transcript
Save Job
```

↓

### BullMQ Queue

```txt
Pending Jobs
```

↓

### Worker

```txt
Gemini Flash
```

↓

### MongoDB

```txt
Store Notes
Store Flashcards
Store Quiz
Store Mindmap Data
```

↓

### Frontend

```txt
Poll Job Status
```

or

```txt
WebSocket Updates
```

---

# Production Recommendation

Use:

**Gemini 2.5 Flash** for:

* Notes
* Summaries
* Flashcards
* Quizzes
* Mindmaps

Use:

**Gemini 2.5 Pro** only for:

* Premium users
* Research mode
* Deep explanations
* Course generation

This keeps costs and rate-limit issues low while maintaining quality. For an MVP, I would cap processing to **1 Gemini call per video**, queue all jobs through BullMQ, and throttle workers to **1 request every 7-8 seconds**. That will comfortably stay within the free-tier limits while supporting dozens to hundreds of videos per day.

[1]: https://ai.google.dev/gemini-api/docs/rate-limits?utm_source=chatgpt.com "Rate limits | Gemini API - Google AI for Developers"
[2]: https://pecollective.com/tools/gemini-free-tier-guide/?utm_source=chatgpt.com "Gemini API Free Tier 2026: Limits, Quotas, and More"
[3]: https://www.aifreeapi.com/en/posts/gemini-api-rate-limits-per-tier?utm_source=chatgpt.com "Gemini API Rate Limits 2026: Complete Per-Tier Guide with ..."
