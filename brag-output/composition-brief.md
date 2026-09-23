# Hyperframes Composition Brief: NoteForge AI

## Objective
Create a short launch-style brag video for NoteForge AI.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 15-25 seconds

## Source Material
- Project root: `/home/sameerbagul/Projects/Github/CV_Projects🤩/Portfolio_CMS/ytvideo2notes/`
- Primary files read: `README.md`, `architecture_flow.html`
- Product name: NoteForge AI
- Tagline / strongest claim: Deterministic Timestamp Slicing: 100% free, takes zero milliseconds, and guarantees perfect contextual boundaries without AI hallucinations.
- Key UI or visual moment to recreate: The glassmorphic Bento UI and the 5-layer architecture diagram.
- Copy that must appear verbatim:
  - Stop summarizing. Start understanding.
  - Powered by LangGraph & Hybrid LLMs
  - Self-correcting RAG. Zero hallucinations.

## Creative Direction
- Tone preset: cinematic
- Creative direction: High-performance, enterprise-grade AI architecture launch.
- Interpretation: Dramatic wipes, fast entrance animations that settle into comfortable reads. No chaotic flashes. It should feel like a serious, premium engineering tool.
- Angle: Enterprise-grade AI built for speed and resilience. The video won't just say "it takes notes"—it will visually emphasize the heavy-duty architecture (Deterministic Chunking, LangGraph self-correction loops, and local fallback) working seamlessly behind a beautiful glassmorphic UI.
- Hook: A Youtube URL is pasted into a sleek input field. It instantly shatters into dozens of timestamped chunks, visually demonstrating the "Deterministic Slicing" feature.
- Outro / punchline: "Don't just summarize. Understand." followed by the NoteForge logo and GitHub link.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign

## Visual Identity
- Background: #0f172a
- Text: #f8f9fa
- Accent: #3b82f6
- Display font: Inter
- Body font: Roboto
- Visual references from the project: The dark theme and deep violet/blue gradients from the architecture flowchart.

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. The Hook — 4s — sleek search bar typing, URL shatters into chunks
2. The Engine — 6s — 5-layer architecture flowchart reveals sequentially
3. Unbreakable Resilience — 5s — LangGraph Critic node correcting a hallucination
4. The Output & Outro — 5s — Rendered study document scrolling over bento UI

## Audio
- Audio role: cinematic support
- Audio arc: Builds from a low pulse during the URL entry, swells during the architecture reveal, hits a crescendo on the final output document, fading to a sustained chord.
- Music: energetic-tech-synth.mp3 (assuming placeholder, or none if unavailable)
- Music treatment: build during the architecture reveal, heavy hit on the final output render.
- Music cue guidance: detect at composition via hyperframes beats
- Audio-reactive treatment: subtle; use RMS/frequency to make the architecture nodes glow/pulse.
- Audio-coupled moments:
  - Scene 1 — typing / shatter
  - Scene 2 — beat reveal of flowchart layers
- SFX selection guidance: Crisp UI interaction sounds, clean swooshes.
- SFX analysis guidance: n/a
- Exact SFX choice: Hyperframes should choose filenames, timestamps, density, and volume based on the implemented animation.
- Audio files: copy the chosen music and any Hyperframes-selected SFX into `brag-output/composition/assets/`

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core` (composition contract + `data-*` timing), `hyperframes-animation` (motion), `hyperframes-creative` (design spec, beats, audio-reactive), `hyperframes-keyframes` (seek-safe keyframes), and `hyperframes-cli` (lint/check/render). /brag is its own workflow: do not enter the `hyperframes` entry-point intent interview and do not route into its generic promo / launch-video workflow. Prefer native Hyperframes conventions over anything in `/brag`.

Requirements:
- Show at least one real UI, copy, or visual element from the source project.
- Keep all text readable in the final render.
- Keep the video within 15-25 seconds.
- Include the planned music/SFX layer unless audio was explicitly disabled or documented as intentionally silent.
- Treat `/brag` audio notes as guidance, not a fixed cue sheet. Choose SFX after the visual animation exists.
- Treat music cue metadata as optional timing hints. Hyperframes decides exact animation timing and should ignore cues that hurt readability, scene pacing, or the product story.
- Major reveals may move toward nearby strong cues within about 0.15s. Smaller entrances may align to nearby beat points within about 0.10s. Use only 1-3 strong cue locks in a 15-25s video unless the edit clearly benefits from more.
- Use SFX to support motion and interaction: card sounds for card-like reveals, short announcement cues for major payoffs, key/click sounds for text or user actions, and restraint when the edit is already busy.
- Honor planned music treatment such as fade-outs, ducking, beat-aligned reveals, or letting a final SFX ring over the music, using the best Hyperframes-supported implementation.
- When music is present and the treatment is not `none`, consider Hyperframes audio-reactive workflow: extract audio data and use RMS/frequency bands for subtle, brand-specific motion. Good targets are glow, depth, background warmth, card presence, title emphasis, or other existing visual elements. Avoid waveform/equalizer visuals, musical-note graphics, generic particle systems, strobing, or heavy pulsing.
- Use local assets for audio and any required runtime/media dependencies when possible.
- Run `hyperframes check` before render — it is brag's single gate.
