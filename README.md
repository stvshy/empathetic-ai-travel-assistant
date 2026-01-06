# ✈️ Empathetic AI Travel Assistant (Empatyczny Asystent Podróży AI)

<div align="center">
  <img src="https://img.shields.io/badge/Sprint-2_Completed-success" alt="Sprint Status" />
  <img src="https://img.shields.io/badge/Stack-React_|_TypeScript_|_Vite-blue" alt="Tech Stack" />
  <img src="https://img.shields.io/badge/AI-Gemini_Flash_Preview-orange" alt="AI Model" />
</div>

<br />

> **Your personal travel planner that senses your emotions.**

## 📖 About The Project

This project is an AI-powered travel assistant designed to plan the perfect trip based on your preferences, budget, and logistical needs.

**Current Status (Sprint 1):**
The application currently operates as a Voice-enabled Chat Interface. It listens to user input, processes it via the cutting-edge **Google Gemini 3 Flash Preview**, and generates a structured travel plan in real-time.

### ✨ Key Features

- 🎤 **Voice Interface:** Talk to the assistant naturally (Web Speech API).
- 🧠 **Context Awareness:** Remembers your budget, style, and previous answers.
- ⚡ **Real-time Responses:** Powered by the fastest Gemini Flash Preview model.
- 🎨 **Modern UI:** Built with Tailwind CSS for a clean, responsive experience.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS
- **AI Core:** Google Gemini API (Generative AI)
- **Voice (Input):** Web Speech API (Browser Native)

---

## 🚀 Run Locally

Follow these steps to get the project running on your local machine.

### Prerequisites

- **Node.js** (Required to run the build tools/Vite. Download version 18+ or 20+).
- A valid **Google Gemini API Key** (Get it for free [here](https://aistudio.google.com/app/apikey)).

### Installation & Startup

1. **Clone the repository**

   ```bash
   git clone https://github.com/stvshy/empathetic-ai-travel-assistant.git
   cd empathetic-ai-travel-assistant

   ```

2. **Install dependencies** (This installs React, Vite, and other libraries)

   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a file named `.env.local` in the root directory and add your API key:

   ```env
   GEMINI_API_KEY=AIzaSy...Your_Actual_Key_Here
   ```

4. **Run the application**
   Start the local development server:

   ```bash
   npm run dev
   ```

5. **Open in Browser**
   Click the link shown in the terminal (usually `http://localhost:5173` or `http://localhost:3000`).

---

## ⚙️ Configuration

### Changing the Gemini Model

By default, this project is configured to use the experimental **Gemini 3 Flash Preview**. If you encounter access issues or want to switch to a stable version (like `gemini-1.5-flash`) or a more capable one (like `gemini-1.5-pro`):

1. Open the file `services/geminiService.ts`.
2. Locate the `generateTravelResponse` function.
3. Update the `model` property:

```typescript
// services/geminiService.ts

const response = await ai.models.generateContent({
  model: "gemini-1.5-flash", // <--- Change this to your desired model name
  contents: prompt,
  // ...
});
```

Common model names:

- `gemini-2.0-flash-exp` (Fast & Smart)
- `gemini-1.5-flash` (Stable & Fast)
- `gemini-1.5-pro` (Reasoning-heavy, slightly slower)

---

## 🗺️ Roadmap

- [x] **Sprint 1:** Core UI, Speech-to-Text, LLM Integration (Gemini 3 Flash).
- [ ] **Sprint 2:** Python Backend Integration (FastAPI).
- [ ] **Sprint 3:** Advanced Emotion Recognition (Wav2Vec) & Text-to-Speech (Piper).

---

## 📄 License

Distributed under the MIT License.

```

```
