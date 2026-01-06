# ✈️ Empathetic AI Travel Assistant

<div align="center">
  <img src="https://img.shields.io/badge/Sprint-3_Completed-success" alt="Sprint Status" />
  <img src="https://img.shields.io/badge/Stack-React_|_TypeScript_|_Vite-blue" alt="Tech Stack" />
  <img src="https://img.shields.io/badge/AI-Gemini_Flash_Lite_Latest-orange" alt="AI Model" />
</div>

<br />

> **Your personal travel planner that senses your emotions.**

## 📖 About The Project

This project is an AI-powered travel assistant designed to plan the perfect trip based on your preferences, budget, and logistical needs.

**Current Status:**
The application operates as a Hybrid System. The Backend (Python) processes audio, detects emotions (using Wav2Vec), and transcribes speech (Whisper), while the Frontend (React) provides a modern chat interface. The **Google Gemini** model acts as the reasoning engine.

### ✨ Key Features

- 🎤 **Advanced Voice Interface:** Uses Web Speech API or OpenAI Whisper for accurate speech-to-text.
- 🧠 **Emotion Recognition (SER):** Detects if you are happy, sad, or uncertain to adjust the travel advice accordingly.
- ⚡ **Real-time Responses:** Powered by Google Gemini Flash Lite.
- 🎨 **Modern UI:** Built with Tailwind CSS for a clean, responsive experience.

---

## 🛠️ Tech Stack

### Backend
- **Core:** Python 3.10+, Flask
- **Speech-to-Text:** OpenAI Whisper
- **Emotion Analysis:** HuggingFace Transformers (Wav2Vec)
- **Tools:** FFmpeg, NumPy

### Frontend
- **Core:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS
- **API:** Web Speech API (Input fallback)
---

## 🚀 Run Locally

Follow these steps to get the project running on your local machine.

### Prerequisites

- A valid **Google Gemini API Key** (Get it for free [here](https://aistudio.google.com/app/apikey)).
- **Docker Desktop** (for Docker method) OR **Node.js** [18+ or 20+] **& Python** [v3.10+] (for Local method).


### Installation & Startup

1. **Clone the repository**

   ```bash
   git clone https://github.com/stvshy/empathetic-ai-travel-assistant.git
   cd empathetic-ai-travel-assistant

   ```

2. **Configure Environment Variables**
   Create a file named `.env.local` in the root directory and add your API key:

   ```env
   GEMINI_API_KEY=AIzaSy...Your_Actual_Key_Here
   ```

### 🐳 Option 1: Quick Start (Docker)

3.  **Run with Docker Compose:**
    ```bash
    docker compose up -d
    ```
    *(The first run will take a few minutes to download AI models).*

4.  **Open in Browser:**
    Go to `http://localhost:3000`.

5.  **Stop:**
    ```bash
    docker compose down
    ```

---

### 🛠️ Option 2: Run Locally (Manual)

Use this if you want to modify the code or if Docker is too heavy for your system.

#### 3. Backend Setup
```bash
cd backend
# Create virtual environment (optional)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies (ffmpeg must be installed in your OS!)
pip install -r requirements.txt

# Run Server
# (Make sure .env is in backend/ folder or GEMINI_API_KEY is set)
python app.py
```

#### 4. Frontend Setup
Open a new terminal:
```bash
cd frontend
npm install
npm run dev
```

---

## ⚙️ Configuration

### Changing the Gemini Model

The model configuration is handled in `backend/app.py`.
To change the model, locate the `generate_gemini_response` function and update the `model` parameter:

```python
# backend/app.py

response = client.models.generate_content(
    model='gemini-flash-lite-latest', # <--- Change model name here
    contents=final_input,
    config=types.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=0.7,
    )
)
```

Common model names:
- `gemini-2.0-flash-exp` (Fast & Smart - Experimental)
- `gemini-1.5-flash` (Stable & Fast)
- `gemini-1.5-pro` (Reasoning-heavy, slightly slower)

---

## 🗺️ Roadmap

- [x] **Sprint 1:** Core UI & LLM Integration.
- [x] **Sprint 2:** Python Backend & Whisper Integration.
- [x] **Sprint 3:** Emotion Recognition (Wav2Vec) & Logic.
- [ ] **Sprint 4:** Server-side Text-to-Speech (Piper) & Final Polish.

---

## 📄 License

Distributed under the MIT License.
```
