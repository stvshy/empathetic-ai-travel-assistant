
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY || "";

export const generateTravelResponse = async (prompt: string): Promise<string> => {
  if (!API_KEY) {
    throw new Error("Missing Gemini API Key");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const systemInstruction = `
    ROLA:
    Jesteś Osobistym Architektem Podróży. Twoim zadaniem nie jest sprzedaż, ale wspólne z użytkownikiem zbudowanie planu idealnego.

    TWOJA BAZA WIEDZY (METODYKA):
    Dobry plan podróży musi uwzględniać:
    1. Tempo (intensywne vs relaks).
    2. Budżet (studencki vs luxury).
    3. Zainteresowania (kultura, natura, jedzenie).
    4. Logistykę (jak się przemieszczać).

    ZASADY:
    - Nie generuj od razu planu na 2 tygodnie. Planuj etapami.
    - Zawsze pytaj o potwierdzenie propozycji przed przejściem dalej.
    - Odpowiadaj w języku polskim.
    - Bądź pomocny i empatyczny.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text || "Przepraszam, nie mogłem wygenerować odpowiedzi.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
