import { GoogleGenAI } from "@google/genai";
import { checkCropDisease } from '../lib/api/advisory';

function dataUrlToFile(dataUrl: string, filename = 'leaf.jpg'): File {
  try {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(parts[1] || parts[0]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch {
    const blob = new Blob([], { type: 'image/jpeg' });
    return new File([blob], filename, { type: 'image/jpeg' });
  }
}

const getGeminiApiKey = () => {
  let viteKey = '';
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      viteKey = import.meta.env.VITE_GEMINI_API_KEY;
    }
  } catch (e) {
    // Ignore error if import.meta is not available in Node.js
  }
  const serverKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  return viteKey || serverKey || '';
};

let aiClient: GoogleGenAI | null = null;

const getGeminiClient = () => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return null;
  }

  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }

  return aiClient;
};

const isGeminiKeyError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('API_KEY_INVALID') || message.includes('API key') || message.includes('API_KEY');
};

export interface WeatherContext {
  confidence: 'high' | 'medium' | 'low';
  primary_source: string;
  rain_7d_mm?: number;
  rain_30d_mm?: number;
  rain_30d_vs_normal_pct?: number | null;
  dry_spell_days?: number;
}

export interface CropInput {
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  temperature: number;
  humidity: number;
  ph: number;
  rainfall: number;
  location?: string;
  weather?: WeatherContext;
}

export interface PredictionResult {
  type: 'crop' | 'disease';
  result: string;
  confidence: number;
  recommendations: string[];
}

const getFallbackCropRecommendation = (input: CropInput, reason: string): PredictionResult => {
  const isAcidic = input.ph < 6;
  const isAlkaline = input.ph > 7.8;
  const isWet = input.rainfall >= 180 || input.humidity >= 75;
  const isDry = input.rainfall < 80 || input.humidity < 45;
  const isCool = input.temperature < 20;
  const isHot = input.temperature > 32;

  let crop = 'Maize';
  let rationale = 'Balanced soil and moderate weather conditions are suitable for maize or similar cereal crops.';

  if (isWet && !isAlkaline) {
    crop = 'Rice';
    rationale = 'High rainfall or humidity favors water-intensive crops like rice.';
  } else if (isDry || isHot) {
    crop = 'Millet';
    rationale = 'Dry or hot conditions favor drought-tolerant crops like millet.';
  } else if (isCool) {
    crop = 'Wheat';
    rationale = 'Cooler temperatures are suitable for wheat and other rabi crops.';
  } else if (isAcidic) {
    crop = 'Potato';
    rationale = 'Slightly acidic soil can support potato when moisture is managed well.';
  } else if (isAlkaline) {
    crop = 'Cotton';
    rationale = 'Mildly alkaline soil and warm conditions can support cotton with proper irrigation.';
  }

  return {
    type: 'crop',
    result: crop,
    confidence: 0.72,
    recommendations: [
      `${reason} Using a local rule-based recommendation instead.`,
      rationale,
      'Verify with a local soil test before final sowing decisions.',
      'Keep nitrogen, phosphorus, and potassium balanced for the chosen crop.'
    ]
  };
};

export const agricultureService = {
  async recommendCrop(input: CropInput): Promise<PredictionResult> {
    const weatherBlock = input.weather
      ? `
    Validated Weather Context:
    - Primary Source: ${input.weather.primary_source}
    - Weather Confidence: ${input.weather.confidence}
    - Recent 7-Day Rainfall: ${input.weather.rain_7d_mm ?? 'N/A'}mm
    - 30-Day Rainfall: ${input.weather.rain_30d_mm ?? 'N/A'}mm (${input.weather.rain_30d_vs_normal_pct != null ? `${input.weather.rain_30d_vs_normal_pct}% vs normal` : 'baseline normal unavailable'})
    - Consecutive Dry Spell: ${input.weather.dry_spell_days ?? 0} days

    ADVISORY CONTRACT RULE:
    ${
      input.weather.confidence === 'low'
        ? 'CRITICAL: Weather confidence is LOW due to provider disagreement or missing validations. You MUST phrase any weather-linked advice as uncertain and conditional. DO NOT give hard "do it now" or imperative instructions for sowing/spraying.'
        : 'Weather confidence is confirmed. Integrate the soil parameters with local rainfall/temperature patterns.'
    }`
      : '';

    const prompt = `As an expert agricultural scientist, recommend the best crop based on these soil and environmental parameters${input.location ? ` for the region of ${input.location}` : ''}:
    Nitrogen: ${input.nitrogen}
    Phosphorus: ${input.phosphorus}
    Potassium: ${input.potassium}
    Temperature: ${input.temperature}°C
    Humidity: ${input.humidity}%
    pH: ${input.ph}
    Rainfall: ${input.rainfall}mm${weatherBlock}

    Provide your response in JSON format with the following structure:
    {
      "crop": "Name of the crop",
      "confidence": 0.0 to 1.0,
      "reasoning": "Brief explanation",
      "recommendations": ["Actionable tip 1", "Actionable tip 2"]
    }`;

    const ai = getGeminiClient();
    if (!ai) {
      console.warn('Gemini API key is not configured. Set VITE_GEMINI_API_KEY for the Vite frontend or GEMINI_API_KEY for server-side usage.');
      return getFallbackCropRecommendation(input, 'Gemini is not configured.');
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text || '{}');
      
      // Confidence threshold check
      if (data.confidence < 0.85) {
        return {
          type: 'crop',
          result: "Inconclusive Data",
          confidence: data.confidence,
          recommendations: ["Please provide more precise soil measurements.", "Consider testing soil at a certified lab."]
        };
      }

      return {
        type: 'crop',
        result: data.crop,
        confidence: data.confidence,
        recommendations: [data.reasoning, ...data.recommendations]
      };
    } catch (error) {
      console.error("Crop recommendation error:", error);
      if (isGeminiKeyError(error)) {
        return getFallbackCropRecommendation(input, 'Gemini rejected the configured API key.');
      }
      return getFallbackCropRecommendation(input, 'Gemini is temporarily unavailable.');
    }
  },

  async detectDisease(base64Image: string, cropHint?: string): Promise<PredictionResult> {
    // 1. First attempt: Grounded backend diagnosis (Architecture §11, §14)
    try {
      const file = dataUrlToFile(base64Image);
      if (file.size > 100) {
        const backendRes = await checkCropDisease(file, cropHint);
        if (backendRes.status === 'model') {
          const treatments = (backendRes.treatments || []).map((t) =>
            `📖 [${t.source_title}${t.page_number ? `, p. ${t.page_number}` : ''}] ${t.treatment_text}`
          );
          return {
            type: 'disease',
            result: backendRes.label,
            confidence: backendRes.confidence,
            recommendations: [
              backendRes.advisory_note,
              ...(treatments.length > 0
                ? treatments
                : ['No specific chemical treatment recorded in the reference catalog. Consult your local KVK for verified control measures.']),
            ],
          };
        }
        if (backendRes.status === 'rejected') {
          return {
            type: 'disease',
            result: backendRes.label || 'Photo Not Usable',
            confidence: 0,
            recommendations: [backendRes.advisory_note],
          };
        }
      }
    } catch (backendErr) {
      console.warn('Backend /api/advisory/disease-check unavailable, falling back:', backendErr);
    }

    // 2. Second attempt: Gemini Vision + RAG Grounding
    const ai = getGeminiClient();
    if (ai) {
      const prompt = `As a plant pathologist, analyze this image of a plant leaf and identify any crop and diseases.
      Provide your response strictly in JSON format:
      {
        "crop": "Crop name (e.g. Tomato, Wheat, Rice, Cotton, Soybean, Maize, or Other)",
        "disease": "Name of the disease or 'Healthy'",
        "confidence": 0.0 to 1.0,
        "description": "Brief description of the symptoms",
        "treatment": ["Treatment step 1", "Treatment step 2"]
      }`;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            { text: prompt },
            { inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] || base64Image } },
          ],
          config: { responseMimeType: 'application/json' },
        });

        const data = JSON.parse(response.text || '{}');

        // Confidence threshold check
        if (data.confidence < 0.8) {
          return {
            type: 'disease',
            result: 'Low Confidence Detection',
            confidence: data.confidence,
            recommendations: [
              'The image quality or symptom clarity is insufficient for a reliable diagnosis.',
              'Please retake the photo in clear daylight, filling the frame with a single affected leaf.',
              'Consult your nearest Krishi Vigyan Kendra (KVK) or local agronomist before applying any treatments.',
            ],
          };
        }

        // Ground treatments via backend RAG retrieve
        let groundedTreatments: string[] = [];
        try {
          const effectiveCrop = data.crop || cropHint;
          const ragRes = await fetch('/api/advisory/retrieve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: `${effectiveCrop || ''} ${data.disease} treatment control management`,
              crop: effectiveCrop,
              disease_label: data.disease,
              doc_types: ['disease_treatment'],
              top_k: 3,
            }),
          });
          if (ragRes.ok) {
            const chunks = await ragRes.json();
            if (Array.isArray(chunks) && chunks.length > 0) {
              groundedTreatments = chunks.map(
                (c: any) =>
                  `📖 [${c.source_title || 'ICAR PoP'}${c.page_number ? `, p. ${c.page_number}` : ''}] ${c.chunk_text}`
              );
            }
          }
        } catch (ragErr) {
          console.warn('Backend RAG retrieve fallback error:', ragErr);
        }

        const recommendations = [
          data.description,
          ...(groundedTreatments.length > 0
            ? groundedTreatments
            : [
                ...(data.treatment || []),
                '⚠️ Notice: Preliminary AI visual estimate (ungrounded). Not verified by ICAR / KVK. Verify all chemical dosages with a local agriculture officer before spraying.',
              ]),
        ];

        return {
          type: 'disease',
          result: data.disease,
          confidence: data.confidence,
          recommendations,
        };
      } catch (error) {
        console.error('Disease detection error:', error);
        if (isGeminiKeyError(error)) {
          return {
            type: 'disease',
            result: 'AI Diagnosis Unavailable',
            confidence: 0,
            recommendations: [
              'Gemini rejected the configured API key. Check the environment variable value.',
              'For verified treatment, show the leaf to your nearest Krishi Vigyan Kendra (KVK).',
            ],
          };
        }
      }
    }

    // 3. Honest Offline Refusal (README §9 / AGENTS.md Data Integrity)
    return {
      type: 'disease',
      result: 'Diagnosis Unavailable',
      confidence: 0,
      recommendations: [
        'Automatic disease identification is currently unavailable (no trained model installed on server, and Gemini API key not configured).',
        'In accordance with data integrity guidelines, ungrounded diagnoses are not fabricated.',
        'Please take a fresh leaf sample to your nearest Krishi Vigyan Kendra (KVK) or local Agriculture Extension Officer.',
      ],
    };
  },
};
