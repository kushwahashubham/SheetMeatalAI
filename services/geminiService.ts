import { GoogleGenAI } from "@google/genai";
import { ExtractedData } from "../types";

const SYSTEM_PROMPT = `
You are an Expert Sheet Metal CAD Engineer. 
Your task is to analyze a PDF containing Technical Data Sheets (TDS) and **Manufacturing Drawings** (usually at the end of the file).

**CRITICAL INSTRUCTION**: Do not just read the text tables. You MUST analyze the **vector drawings/diagrams** to identify the specific sheet metal parts required.

### 1. Project Extraction
Extract the "Unit_Ref" (e.g., ECU-01) and "Global_Dims" (L, W, H).
Extract "Base_Height" from the text or drawing (e.g., 100mm C-channel).
Extract "Insulation" thickness (e.g., 25mm, 50mm).

### 2. Panel & Part Identification (The Visual Analysis)
Look at the "Exploded View" or "2D Views" in the PDF. Identify the distinct sheet metal components.
For this specific AHU type, we expect:
- **Base Frame Rails**: Long C-channels.
- **Outer Skin Panels**: The visible exterior panels.
- **Inner Skin Panels**: The panels inside (usually smaller by 2x Insulation).
- **Connection Spigots/Cuts**: Holes for Fresh Air (FA) and Supply Air (SA). Extract their dimensions (W x H) if available.

### 3. Geometry Extraction Rules
For each identified panel, estimate or calculate:
- **Flat_W / Flat_H**: The dimensions of the flat sheet. 
  - *Rule*: If drawing shows a box of Height H and it sits on a Base B, the Panel Height is H - B.
- **Holes/Punches**: Look for circles or rectangles inside the panels (ports, cable glands).
  - Estimate their center (x, y) relative to the bottom-left corner of that panel.
  - Estimate dimensions (diameter or w/h).
- **Qty**: How many of this specific panel are needed?

### 4. Output Format
Return strictly valid JSON matching this schema:

\`\`\`json
{
  "Project_ID": "string",
  "Unit_Ref": "string",
  "Global_Dims": {"L": number, "W": number, "H": number},
  "Base_Height": number,
  "Material_Specs": {
    "Outer_Material": "string (e.g. 0.8mm Painted)",
    "Inner_Material": "string (e.g. 0.8mm Galv)"
  },
  "Material": {
    "Insulation": number
  },
  "Cuts": {
    "Fresh_Air": {"W": number, "H": number},
    "Supply_Air": {"W": number, "H": number}
  },
  "Parts_List": [
    {
      "Part_Name": "string (e.g. 'Outer_Side_Panel', 'Front_Face_Panel')",
      "Type": "Panel" | "Profile",
      "Material": "string",
      "Qty": number,
      "Width_mm": number,
      "Height_mm": number,
      "Notes": "string",
      "Holes": [
        { "Shape": "Circle" | "Rect", "X": number, "Y": number, "W_or_Dia": number, "H": number }
      ]
    }
  ]
}
\`\`\`

**HINT**: If exact hole coordinates are not explicitly labeled, estimate them based on the drawing proportions (e.g., "Center of panel").
`;

export const processPdfWithGemini = async (base64Pdf: string): Promise<ExtractedData> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not configured");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const model = ai.models;
    
    // Switch to Gemini 3.0 Pro for better Vision/Engineering analysis
    const response = await model.generateContent({
      model: 'gemini-3-pro-preview', 
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        temperature: 0.2, // Lower temperature for more precise/deterministic extraction
      },
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: base64Pdf
            }
          },
          {
            text: "Analyze the manufacturing drawings at the end of this PDF. Generate a precise Cut List and Part Geometry JSON."
          }
        ]
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response text from Gemini");

    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson) as ExtractedData;

  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw error;
  }
};