/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload limit to support base64 interior images safely
app.use(express.json({ limit: "15mb" }));

// Initialize Gemini on server
let aiClient: GoogleGenAI | null = null;

function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
       return null;
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// 1. Health check API
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Helper: Generates beautiful mock data if no API Key is set to keep app functional
function getPremiumMockResponse(roomType: string, style: string, budget: number) {
  const parsedBudget = Number(budget) || 1200;
  
  const mockOptions: Record<string, any> = {
    "Obývacia izba": {
      summary: "Tento priestor obývacej izby má skvelý potenciál. Analyzovali sme usporiadanie a navrhujeme presunúť ťažisko izby smerom k prirodzenému zdroju svetla (oknu). Odstránením prebytočných dekorácií a zameraním sa na čisté organické materiály dosiahneme želaný Swiss-Minimalist pocit vzdušnosti. Hlavná pohovka dostane nový svetlosivý poťah, ktorý opticky rozšíri miestnosť.",
      colorPalette: ["#FAF8F5", "#1C1C1C", "#8D908E", "#C2B29F", "#DCD3C1"],
      materials: ["Svetlé masívne dubové drevo", "Prútená štruktúra koberca", "Línová poťahová látka", "Matný dymový hliník"],
      lightingTips: "Uvoľnite parapety okien pre maximalizáciu toku denného svetla. Pridajte jedno lomené dizajnové stojanové svietidlo do tmavého rohu pre vytvorenie vrstvenej svetelnej atmosféry (hrejivá teplota 2700K).",
      furnitureLayout: [
        {
          name: "Sedačka v tvare L (Svetlosivá)",
          category: "Sedačka",
          coordinateX: 25,
          coordinateY: 35,
          width: 220,
          depth: 95,
          estimatedPrice: Math.floor(parsedBudget * 0.45),
          storeRecommendation: "IKEA (SÖDERHAMN)",
          description: "Nízka, modulárna minimalistická pohovka, ktorá nezaťažuje výšku stropu."
        },
        {
          name: "Konferenčný stolík z masívneho duba",
          category: "Stolík",
          coordinateX: 45,
          coordinateY: 55,
          width: 90,
          depth: 60,
          estimatedPrice: Math.floor(parsedBudget * 0.15),
          storeRecommendation: "Sconto Nábytok",
          description: "Okrúhly a organický tvar, ktorý prebije prísne pravouhlé línie stien."
        },
        {
          name: "Štruktúrovaný vlnený koberec",
          category: "Doplnky",
          coordinateX: 35,
          coordinateY: 45,
          width: 240,
          depth: 170,
          estimatedPrice: Math.floor(parsedBudget * 0.18),
          storeRecommendation: "Bonami",
          description: "Mäkký off-white textúrny prechod pod konferenčný stolík pre haptické teplo."
        },
        {
          name: "Stojanová lampa s ramenom",
          category: "Svietidlo",
          coordinateX: 15,
          coordinateY: 20,
          width: 38,
          depth: 38,
          estimatedPrice: Math.floor(parsedBudget * 0.08),
          storeRecommendation: "Jysk",
          description: "Tenké čierne oceľové klenuté rameno s hrejivým difúznym svetlom."
        },
        {
          name: "Drevená komoda",
          category: "Skrinka",
          coordinateX: 75,
          coordinateY: 30,
          width: 140,
          depth: 40,
          estimatedPrice: Math.floor(parsedBudget * 0.14),
          storeRecommendation: "IKEA (MALM)",
          description: "Plochá a čistá skrinka bez viditeľných úchytiek na uloženie drobností."
        }
      ]
    },
    "Spálňa": {
      summary: "Analyzovaný priestor spálne vykazuje zbytočné vizuálne preťaženie v oblasti čela postele. Odporúčame upustiť od veľkého počtu vankúšov a aplikovať striedme, čisté prikrývky na posteľ. Nová spacie zóna bude umiestnená presne do stredu osi steny, čo miestnosti dodá elegantnú symetriu po vzore švajčiarskych butikových hotelov.",
      colorPalette: ["#F3EFE9", "#292929", "#7F7A74", "#C6BDB1", "#E6DFD5"],
      materials: ["Prírodný surový ľan", "Bielený jaseň", "Brúsená nerezová oceľ", "Hladená omietka"],
      lightingTips: "Nahraďte klasické nočné stolné lampy závesnými minimalistickými svietidlami visiacimi priamo zo stropu, čím uvoľníte nočné stolíky. Teplota svetla ideálne 2500K pre navodenie spánkového režimu.",
      furnitureLayout: [
        {
          name: "Rám postele 'Bielený jaseň'",
          category: "Posteľ",
          coordinateX: 40,
          coordinateY: 25,
          width: 190,
          depth: 210,
          estimatedPrice: Math.floor(parsedBudget * 0.52),
          storeRecommendation: "Sconto Nábytok",
          description: "Nízkoprofilový jaseňový rám postele so zapustenými nožičkami pre levitujúci efekt."
        },
        {
          name: "Ľanové závesy sand-beige",
          category: "Doplnky",
          coordinateX: 90,
          coordinateY: 50,
          width: 160,
          depth: 2,
          estimatedPrice: Math.floor(parsedBudget * 0.12),
          storeRecommendation: "IKEA",
          description: "Bohaté zatmievacie závesy pohlcujúce slnečné lúče s jemnou, 100% ľanovou štruktúrou."
        },
        {
          name: "Matný kovový nočný stolík",
          category: "Stolík",
          coordinateX: 25,
          coordinateY: 20,
          width: 40,
          depth: 40,
          estimatedPrice: Math.floor(parsedBudget * 0.10),
          storeRecommendation: "Bonami",
          description: "Jednoduchá kovová kocka v hlbokej grafitovej sivej ako čistý kubistický tón."
        },
        {
          name: "Matný kovový nočný stolík pravý",
          category: "Stolík",
          coordinateX: 75,
          coordinateY: 20,
          width: 40,
          depth: 40,
          estimatedPrice: Math.floor(parsedBudget * 0.10),
          storeRecommendation: "Bonami",
          description: "Dokonale symetrický náprotivok pre optickú vyváženosť spacieho priestoru."
        },
        {
          name: "Otočné nástenné čítacie svietidlo",
          category: "Svietidlo",
          coordinateX: 20,
          coordinateY: 10,
          width: 25,
          depth: 15,
          estimatedPrice: Math.floor(parsedBudget * 0.16),
          storeRecommendation: "Jysk",
          description: "Bodové, smerovateľné čierne LED svietidlo s úzkym lúčom na čítanie."
        }
      ]
    },
    "Kuchyňa": {
      summary: "Kuchynskému priestoru prospieva úplné vyčistenie pracovnej dosky. Analyzovali sme zóny a odporúčame skrytie spotrebičov do vstavaných skríň. Swiss-redizajn nariaďuje osadenie monochromatického zadného panelu z matného kompozitu a pridanie jedného solitérneho jedálenského stola namiesto starých tónovaných stoličiek.",
      colorPalette: ["#F9F9F9", "#111111", "#4A4D4A", "#969996", "#E1E1E1"],
      materials: ["Svetlosivý mramor", "Matný čierny lak", "Lisovaná preglejka", "Kalene mliečne sklo"],
      lightingTips: "Pridajte skryté bezdotykové LED pásy na spodnú časť horných závesných skriniek. Hlavný stôl doplňte o jedno dominantné valovité matné svietidlo.",
      furnitureLayout: [
        {
          name: "Jedálenský stôl 'Kompaktná dýha'",
          category: "Stolík",
          coordinateX: 50,
          coordinateY: 65,
          width: 120,
          depth: 80,
          estimatedPrice: Math.floor(parsedBudget * 0.40),
          storeRecommendation: "IKEA",
          description: "Minimalistický stôl s ultratenkou doskou a čiernymi kovovými nohami."
        },
        {
          name: "Sada preglejkových stoličiek (2ks)",
          category: "Doplnky",
          coordinateX: 35,
          coordinateY: 70,
          width: 42,
          depth: 45,
          estimatedPrice: Math.floor(parsedBudget * 0.25),
          storeRecommendation: "Jysk (Lajka)",
          description: "Prírodné tvarované stoličky s vysokou ergonomickou hodnotou bez vizuálneho hluku."
        },
        {
          name: "Valcové závesné svietidlo",
          category: "Svietidlo",
          coordinateX: 50,
          coordinateY: 50,
          width: 30,
          depth: 30,
          estimatedPrice: Math.floor(parsedBudget * 0.15),
          storeRecommendation: "Bonami",
          description: "Dominantné jednoduché svietidlo nad stred jedálenského stola."
        },
        {
          name: "Nástenná polica na bylinky",
          category: "Skrinka",
          coordinateX: 80,
          coordinateY: 35,
          width: 60,
          depth: 15,
          estimatedPrice: Math.floor(parsedBudget * 0.08),
          storeRecommendation: "IKEA",
          description: "Vertikálna klenba z masívnej bielej ocele dodáva priestoru život a sviežosť."
        },
        {
          name: "Organizér na pracovnú dosku",
          category: "Doplnky",
          coordinateX: 15,
          coordinateY: 40,
          width: 30,
          depth: 20,
          estimatedPrice: Math.floor(parsedBudget * 0.06),
          storeRecommendation: "Westwing",
          description: "Príručný porcelánový zásobník na korenie pre varenie s čistou stolárskou formou."
        }
      ]
    }
  };

  const selected = mockOptions[roomType] || mockOptions["Obývacia izba"];
  return {
    roomType,
    aestheticStyle: style,
    summary: selected.summary,
    colorPalette: selected.colorPalette,
    materials: selected.materials,
    lightingTips: selected.lightingTips,
    furnitureLayout: selected.furnitureLayout
  };
}

// 2. Redesign POST api
async function tryGenerateMistralImage(style: string, roomType: string, summary: string, materials: string[], key: string): Promise<string | null> {
  if (!key || key.trim() === "" || key === "MY_MISTRAL_API_KEY") return null;
  try {
    console.log("Automatically generating photorealistic design using Mistral flux-pro-latest...");
    const matsText = materials && materials.length > 0 ? materials.join(", ") : "premium natural materials";
    const prompt = `A highly realistic, photorealistic, premium interior architecture digest photo of a newly redesigned ${roomType.toLowerCase()} in a stunning ${style} style. Description: ${summary || ""}. Materials to use: ${matsText}. Strict layout preservation, exact wall placement matching the room, elegant natural direct afternoon lighting, professional 35mm photograph, architectural digest feature look, 8k resolution, ultra realism.`;
    
    const response = await fetch("https://api.mistral.ai/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "flux-pro-latest",
        prompt: prompt,
        n: 1,
        size: "1024x1024"
      })
    });

    if (response.ok) {
      const resJson: any = await response.json();
      const url = resJson.data?.[0]?.url;
      if (url) {
        console.log("Successfully generated automatic image over Mistral API:", url);
        return url;
      }
    } else {
      const errorText = await response.text();
      console.log(`[Mistral Image Gen Status] API returned error status ${response.status}: ${errorText.substring(0, 150)}...`);
    }
  } catch (err: any) {
    console.log("[Mistral Image Gen Warning] Network or operational failure: ", err?.message || err);
  }
  return null;
}

app.post("/api/redesign", async (req, res) => {
  const { image, roomType, style, budget, provider } = req.body;

  if (!roomType || !style) {
    return res.status(400).json({ error: "Chýbajúce parametre: roomType, style." });
  }

  const ai = getGeminiClient();
  const mistralKey = process.env.MISTRAL_API_KEY;
  const useMistral = (provider === "mistral" || (!ai && typeof mistralKey === "string" && mistralKey.trim() !== "" && mistralKey !== "MY_MISTRAL_API_KEY"));

  // If client is null (no API key configured), fall back to beautiful premium mockup simulation
  if (!ai && !useMistral) {
    console.log("No GEMINI_API_KEY or MISTRAL_API_KEY detected. Serving high-fidelity simulated response.");
    const mockData = getPremiumMockResponse(roomType, style, budget);
    return res.json({
      success: true,
      data: mockData,
      isSimulated: true,
      simulationMetrics: {
        geminiTokensInput: 680,
        geminiTokensOutput: 345,
        estimatedCostEur: 0.00015 // Tiny cost metrics representation
      },
      message: "Formátované v režime Simulácie, keďže chýbajú kľúče pre AI modely."
    });
  }

  try {
    let base64Data = "";
    if (image) {
      // Clean prefix if exist: e.g. "data:image/jpeg;base64,..."
      base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    }

    const systemPrompt = `Si špičkový interiérový architekt vyznávajúci švajčiarsky minimalizmus, funkčnosť, precízne meranie a prácu s negatívnym priestorom.
Analyzuj pošlaný priestor (${roomType}) z fotografie. Dôkladne zhodnoť usporiadanie stien, okien, dverí a celkové dispozičné rozmery miestnosti (dĺžku, šírku a výšku).
Tvojou úlohou je navrhnúť kompletný interiérový redizajn v štýle: ${style} s prísnym obmedzením celkového rozpočtu do ${budget} EUR.

Musíš dbať na nasledujúce konštrukčné a rozmerové pravidlá:
1. MAXIMÁLNA PODOBNOSŤ: Nový návrh musí rešpektovať pôvodné rozmery, dĺžku a šírku miestnosti. Nepridávaj priečky ani nezasahuj do nosných konštrukcií zobrazených na fotke.
2. PRESNOSŤ SÚRADNÍC: 2D pôdorys nábytku ("furnitureLayout") musí reprezentovať reálne rozmiestnenie. Súradnica coordinateX (0 až 100% zľava doprava) a coordinateY (0 až 100% zhora nadol) musia presne odrážať pozíciu voči stenám a oknám zachyteným na fotografii.
3. REÁLNE ROZMERY: Každý kus nábytku musí mať zmysluplnú šírku a hĺbku v centimetroch (napr. štandardná sedačka šírka 200-240cm, hĺbka 90-100cm).
4. ROZPOČTOVÁ INTEGRITA: Súčet cien "estimatedPrice" všetkých položiek nesmie prekročiť limit ${budget} EUR. Odporúčaj reálne obchody v SR dostupné pre daný rozpočet.

Priprav kompletný návrh pozostávajúci zo slovenského zhodnotenia pôvodného stavu vs nového návrhu, zoznamu prémiových materiálov, odporúčaní pre rozloženie osvetlenia a presného 2D rozloženia nábytku vo forme relatívnych percentuálnych súradníc. Odpovedz výhradne vo validnom JSON formáte nachádzajúcom sa pod touto inštrukciou.`;

    const responseSchema = {
      type: "object",
      properties: {
        roomType: { type: "string" },
        aestheticStyle: { type: "string" },
        summary: {
          type: "string",
          description: "Odborná analýza súčasného priestoru po slovensky s konkrétnymi dizajnovými vylepšeniami v duchu švajčiarskeho minimalizmu."
        },
        colorPalette: {
          type: "array",
          items: { type: "string" },
          description: "Zoznam 4 až 5 harmonických HEX kódov pre steny a hlavný nábytok."
        },
        materials: {
          type: "array",
          items: { type: "string" },
          description: "Odporúčané udržateľné a vysoko kvalitné materiály (napr. bielená borovica, kompozitný kremeň)."
        },
        lightingTips: {
          type: "string",
          description: "Tipy pre inteligentné rozvrstvenie nepriameho a priameho osvetlenia (v slovenčine)."
        },
        furnitureLayout: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Názov kusu nábytku v slovenskom jazyku." },
              category: { type: "string", description: "Kategória predmetu (sedačka, stôl, polica, svietidlo apod.)." },
              coordinateX: { type: "integer", description: "Relatívna šírková súradnica na 2D pôdoryse (0 až 100)." },
              coordinateY: { type: "integer", description: "Relatívna hĺbková súradnica na 2D pôdoryse (0 až 100)." },
              width: { type: "integer", description: "Šírka v centimetroch." },
              depth: { type: "integer", description: "Hĺbka v centimetroch." },
              estimatedPrice: { type: "integer", description: "Odhadovaná cena v EUR." },
              storeRecommendation: { type: "string", description: "Konkrétny reálny obchod (napr. IKEA, Jysk, Sconto)." },
              description: { type: "string", description: "Prečo a ako tento nábytok v priestore využiť (slovensky)." }
            },
            required: ["name", "category", "coordinateX", "coordinateY", "width", "depth", "estimatedPrice", "storeRecommendation", "description"]
          }
        }
      },
      required: ["roomType", "aestheticStyle", "summary", "colorPalette", "materials", "lightingTips", "furnitureLayout"]
    };

    if (useMistral) {
      console.log("Executing redesign query using Mistral AI API...");
      const modelName = base64Data ? "pixtral-12b-2409" : "mistral-large-latest";
      
      const userContent: any[] = [
        {
          type: "text",
          text: `Analyzuj izbu typu ${roomType} a vygeneruj pre ňu moderný ${style} redizajn s rozpočtom ${budget} EUR. Odpovedaj striktne v slovenskom jazyku a vráť formátovaný JSON podľa schémy.`
        }
      ];

      if (base64Data) {
        userContent.push({
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${base64Data}`
          }
        });
      }

      const mResponse = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${mistralKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: "system",
              content: `${systemPrompt}\n\nMusíš odpovedať výhradne vo validnom JSON formáte, ktorý striktne vyhovuje tomuto JSON-Schema opisu:\n${JSON.stringify(responseSchema, null, 2)}`
            },
            {
              role: "user",
              content: userContent
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.2
        })
      });

      if (!mResponse.ok) {
        const errorText = await mResponse.text();
        throw new Error(`Mistral API error (${mResponse.status}): ${errorText}`);
      }

      const mJson: any = await mResponse.json();
      const textOutput = mJson.choices?.[0]?.message?.content;
      if (!textOutput) {
        throw new Error("Mistral API nevrátilo žiadny textový výstup.");
      }

      const parsedJson = JSON.parse(textOutput.trim());
      
      // Automatically attempt image generation if Mistral key is configured
      const generatedImageUrl = await tryGenerateMistralImage(style, roomType, parsedJson.summary, parsedJson.materials, mistralKey || "");

      const promptLen = systemPrompt.length + (base64Data ? base64Data.length : 0);
      const respLen = textOutput.length;
      const inputTokens = Math.floor(promptLen / 4) + 150;
      const outputTokens = Math.floor(respLen / 4);

      return res.json({
        success: true,
        data: parsedJson,
        isSimulated: false,
        generatedImageUrl: generatedImageUrl,
        simulationMetrics: {
          geminiTokensInput: inputTokens,
          geminiTokensOutput: outputTokens,
          estimatedCostEur: (inputTokens * 0.00000015) + (outputTokens * 0.0000006)
        },
        provider: "mistral"
      });
    }

    // Default to Gemini API if useMistral is false

    // Prepare inputs for Gemini
    const contentParts: any[] = [];
    if (base64Data) {
      contentParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data
        }
      });
    }
    contentParts.push({
      text: `Analyzuj priloženú fotografiu izby a vygeneruj pre ňu moderný ${style} redizajn. Rozpočet je ${budget} EUR. Odpovedaj detailne s nábytkom vo forme 2D mapy.`
    });

    // Invoke Gemini 2.5 Flash as requested (which is incredibly optimal for response times and limits!)
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: contentParts },
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("Gemini API nevrátilo žiadny textový výstup.");
    }

    const parsedJson = JSON.parse(textOutput.trim());
    
    // Automatically attempt image generation if Mistral key is configured for a realistic 3D mockup visual
    const generatedImageUrl = await tryGenerateMistralImage(style, roomType, parsedJson.summary, parsedJson.materials, mistralKey || "");
    
    // Calculate approximate tokens for our statistics tracker (1 character ~ 4 characters per token estimate)
    const promptLen = systemPrompt.length + (base64Data ? base64Data.length : 0);
    const respLen = textOutput.length;
    const inputTokens = Math.floor(promptLen / 4) + 200; // estimated
    const outputTokens = Math.floor(respLen / 4);

    return res.json({
      success: true,
      data: parsedJson,
      isSimulated: false,
      generatedImageUrl: generatedImageUrl,
      simulationMetrics: {
        geminiTokensInput: inputTokens,
        geminiTokensOutput: outputTokens,
        estimatedCostEur: (inputTokens * 0.00000015) + (outputTokens * 0.0000006) // standard cost estimation to build trust in Spark Plan limits
      }
    });

  } catch (err: any) {
    console.error("Gemini API execution error:", err);
    // Standardize error or catch 429 rate limit / quota exceeded
    const isRateLimit = err.message?.includes("429") || err.message?.toLowerCase().includes("quota");
    return res.status(isRateLimit ? 429 : 500).json({
      error: isRateLimit 
        ? "Služba je momentálne vyťažená. Váš požiadavok prebehne automaticky o 15 sekúnd."
        : `Chyba pri spracovaní AI redizajnu: ${err.message || err}`
    });
  }
});

// 3. Vite Server or Production static routes
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Sídlo na porte http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
