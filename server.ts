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

// Helper: Builds universal architectural prompt strictly following spatial fidelity and user wishes
export function buildUniversalRenderPrompt(params: {
  roomType: string;
  style: string;
  userWishes?: string;
  materials?: string[];
  colorPalette?: string[];
  furnitureLayout?: Array<{ name: string; category?: string }>;
  summary?: string;
}): string {
  const targetRoom = (params.roomType || "obývacia izba").toLowerCase();

  let sDesc = "Swiss-Minimalist architecture, clean strict grid alignment, extreme physical discipline, tactile concrete wall panels paired with light bleached oak wood cabinets, pure focus on empty intervals (negative space), and high-end built-in ambient lighting";
  if (params.style === "Japandi") {
    sDesc = "warm Japandi interior style, organic curves combined with strict Scandinavian functionalism, soft clay plaster walls, low solid timber platform furniture, tactile cream linen fabrics, delicate hanging washi paper rice lanterns";
  } else if (params.style === "Nordic") {
    sDesc = "cozy Scandinavian Nordic feel, whitewashed rustic wood flooring, bright airy northern daylight, pale light pine accents, cozy brushed wool throws, and simple matte black architectural hardware";
  } else if (params.style === "Industrial") {
    sDesc = "Industrial architecture, clean raw metal framing, exposed brick structures, reclaimed oak surfaces, and warm architectural track lighting";
  }

  const userWishesDirective = params.userWishes?.trim()
    ? `\nUSER CUSTOM REQUIREMENTS: Strictly incorporate and prioritize the following client specifications: "${params.userWishes.trim()}". Ensure each of these requested elements is prominently featured, properly positioned, and seamlessly designed into the room.`
    : "";

  const mats = params.materials && params.materials.length > 0
    ? params.materials.join(", ")
    : "Svetlé masívne dubové drevo, Prútená štruktúra koberca, Línová poťahová látka, Matný dymový hliník";

  const colors = params.colorPalette && params.colorPalette.length > 0
    ? params.colorPalette.join(", ")
    : "#FAF8F5, #1C1C1C, #8D908E, #C2B29F, #DCD3C1";

  let layoutPieces = "Sedačka v tvare L (Svetlosivá) in category Sedačka, Konferenčný stolík z masívneho duba in category Stolík, Štruktúrovaný vlnený koberec in category Doplnky, Stojanová lampa s ramenom in category Svietidlo, Drevená komoda in category Skrinka";
  if (params.furnitureLayout && params.furnitureLayout.length > 0) {
    layoutPieces = params.furnitureLayout.map(f => `${f.name}${f.category ? ` in category ${f.category}` : ""}`).join(", ");
  } else if (params.userWishes?.trim()) {
    layoutPieces = `${params.userWishes.trim()}, doplnené o harmonické minimalistické prvky`;
  }

  return `Highly realistic, photorealistic interior architectural design of the inside of this exact ${targetRoom}. 
SPATIAL FIDELITY ENFORCEMENT: Retain 100% of the original spatial geometry, including the exact ceiling borders, structural walls, window placement, door frames, and camera field of view from the reference picture. Absolutely no structural changes.
DESIGN DIRECTIVE: Redesign and furnish the room using ${sDesc}.${userWishesDirective}
MATERIALITY: Apply high-quality realistic materials like: ${mats}.
COLOR SCHEME: Apply this exact color palette: ${colors}.
LAYOUT: Cleanly furnish the space with: ${layoutPieces}.
RENDERING DETAILS: High-end architectural digest publication photo, realism, soft diffused warm light (2700K), captured on professional 35mm lens, atmospheric depth, realistic soft shadows, 8k resolution, photoreal. STRICTLY INDOOR SHOT, NO OUTDOOR SCENERY, NO EXTERIOR VIEW, PURE INTERNAL PHOTOGRAPH.`;
}

// 2. Redesign POST api
async function tryGenerateMistralImage(
  style: string,
  roomType: string,
  summary: string,
  materials: string[],
  key: string,
  userWishes?: string,
  colorPalette?: string[],
  furnitureLayout?: any[]
): Promise<string | null> {
  if (!key || key.trim() === "" || key === "MY_MISTRAL_API_KEY") return null;
  
  const prompt = buildUniversalRenderPrompt({
    roomType,
    style,
    userWishes,
    materials,
    colorPalette,
    furnitureLayout,
    summary,
  });

  const modelsToTry = ["flux-pro-latest", "flux-pro"];
  
  for (const model of modelsToTry) {
    try {
      console.log(`Automatically generating photorealistic design using Mistral ${model}...`);
      const response = await fetch("https://api.mistral.ai/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`
        },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          n: 1,
          size: "1024x1024"
        })
      });

      if (response.ok) {
        const resJson: any = await response.json();
        const url = resJson.data?.[0]?.url;
        if (url) {
          console.log(`Successfully generated automatic image over Mistral API using model ${model}:`, url);
          return url;
        }
      } else {
        const errorText = await response.text();
        console.log(`[Mistral Image Gen Info] API response status ${response.status} for model ${model}. This model is exclusive to premium pay-as-you-go accounts with active payment methods.`);
        
        // If it is a 404, we can retry with the next model if available
        if (response.status === 404 && model !== modelsToTry[modelsToTry.length - 1]) {
          console.log(`Trying alternative model in cascade...`);
          continue;
        }
        break; // Stop trying if other errors or last model
      }
    } catch (err: any) {
      console.log(`[Mistral Image Gen Warning] Operational failure with ${model}: `, err?.message || err);
    }
  }
  return null;
}

// Helper: Generates a completely original image using Google Gemini (Imagen)
async function tryGenerateGeminiImage(
  style: string,
  roomType: string,
  summary: string,
  materials: string[],
  userWishes?: string,
  base64Image?: string,
  colorPalette?: string[],
  furnitureLayout?: any[]
): Promise<string | null> {
  const ai = getGeminiClient();
  if (!ai) {
    return null;
  }

  const prompt = buildUniversalRenderPrompt({
    roomType,
    style,
    userWishes,
    materials,
    colorPalette,
    furnitureLayout,
    summary,
  });

  try {
    const response = await ai.models.generateImages({
      model: "imagen-3.0-generate-002",
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: "image/jpeg",
        aspectRatio: "1:1",
      },
    });

    const base64Bytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (base64Bytes) {
      console.log("[Gemini Imagen] Successfully generated original image with Google Imagen!");
      return `data:image/jpeg;base64,${base64Bytes}`;
    }
  } catch (gErr: any) {
    console.log("[Gemini Imagen] Imagen generation not enabled on key, using layout rendering:", gErr?.message || gErr);
  }

  return null;
}

app.post("/api/redesign", async (req, res) => {
  const { image, roomType, style, budget, provider, userWishes, customSystemPrompt } = req.body;

  if (!roomType || !style) {
    return res.status(400).json({ error: "Chýbajúce parametre: roomType, style." });
  }

  const ai = getGeminiClient();
  const mistralKey = process.env.MISTRAL_API_KEY;
  const hasValidMistralKey = typeof mistralKey === "string" && mistralKey.trim() !== "" && mistralKey !== "MY_MISTRAL_API_KEY";
  let useMistral = (provider === "mistral" && hasValidMistralKey) || (!ai && hasValidMistralKey);

  let base64Data = "";
  if (image) {
    // Clean prefix if exist: e.g. "data:image/jpeg;base64,..."
    base64Data = image.replace(/^data:image\/\w+;base64,/, "");
  }

  const userWishesBlock = userWishes && typeof userWishes === "string" && userWishes.trim() !== ""
    ? `\nPOŽIADAVKY KLIENTA NA VYGENEROVANIE:
Používateľ si výslovne želá v novom interiéri: "${userWishes.trim()}".
Tieto prvky MUSÍŠ prioritne a povinne zakomponovať do zoznamu "furnitureLayout" (s presnými súradnicami coordinateX, coordinateY, reálnymi rozmermi a cenou), ako aj do "summary" a "materials"!\n`
    : "";

  const baseSystemPrompt = `Si špičkový interiérový architekt vyznávajúci švajčiarsky minimalizmus, funkčnosť, precízne meranie a prácu s negatívnym priestorom.
Analyzuj pošlaný priestor (${roomType}) z fotografie. Dôkladne zhodnoť usporiadanie stien, okien, dverí a celkové dispozičné rozmery miestnosti (dĺžku, šírku a výšku).
Tvojou úlohou je navrhnúť kompletný interiérový redizajn v štýle: ${style} s prísnym obmedzením celkového rozpočtu do ${budget} EUR.
${userWishesBlock}
Musíš dbať na nasledujúce konštrukčné a rozmerové pravidlá:
1. MAXIMÁLNA PODOBNOSŤ & SPATIAL FIDELITY: Retain 100% of the original spatial geometry, including the exact ceiling borders, structural walls, window placement, door frames, and camera field of view from the reference picture. Nový návrh musí rešpektovať pôvodné rozmery, dĺžku a šírku miestnosti. Nepridávaj priečky ani nezasahuj do nosných konštrukcií zobrazených na fotke.
2. PRESNOSŤ SÚRADNÍC: 2D pôdorys nábytku ("furnitureLayout") musí reprezentovať reálne rozmiestnenie. Súradnica coordinateX (0 až 100% zľava doprava) a coordinateY (0 až 100% zhora nadol) musia presne odrážať pozíciu voči stenám a oknám zachyteným na fotografii.
3. REÁLNE ROZMERY: Každý kus nábytku musí mať zmysluplnú šírku a hĺbku v centimetroch (napr. štandardná sedačka šírka 200-240cm, hĺbka 90-100cm).
4. ROZPOČTOVÁ INTEGRITA: Súčet cien "estimatedPrice" všetkých položiek nesmie prekročiť limit ${budget} EUR. Odporúčaj reálne obchody v SR dostupné pre daný rozpočet.

Priprav kompletný návrh pozostávajúci zo slovenského zhodnotenia pôvodného stavu vs nového návrhu, zoznamu prémiových materiálov, odporúčaní pre rozloženie osvetlenia a presného 2D rozloženia nábytku vo forme relatívnych percentuálnych súradníc. Odpovedz výhradne vo validnom JSON formáte nachádzajúcom sa pod touto inštrukciou.`;

  const systemPrompt = customSystemPrompt && typeof customSystemPrompt === "string" && customSystemPrompt.trim() !== ""
    ? `${customSystemPrompt.trim()}\n\n${userWishesBlock}\n\nMusíš odpovedať výhradne vo validnom JSON formáte podľa schémy.`
    : baseSystemPrompt;

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

  // 1. Try Mistral if requested and key is present
  if (useMistral) {
    try {
      console.log("Executing redesign query using Mistral AI API...");
      const modelName = base64Data ? "pixtral-12b-2409" : "mistral-large-latest";
      
      const userTextPrompt = userWishes?.trim()
        ? `Analyzuj izbu typu ${roomType} a vygeneruj pre ňu moderný ${style} redizajn s rozpočtom ${budget} EUR. Používateľ si želá v izbe výslovne tieto prvky: "${userWishes.trim()}". Odpovedaj striktne v slovenskom jazyku a vráť formátovaný JSON podľa schémy.`
        : `Analyzuj izbu typu ${roomType} a vygeneruj pre ňu moderný ${style} redizajn s rozpočtom ${budget} EUR. Odpovedaj striktne v slovenskom jazyku a vráť formátovaný JSON podľa schémy.`;

      const userContent: any[] = [
        {
          type: "text",
          text: userTextPrompt
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

      if (mResponse.ok) {
        const mJson: any = await mResponse.json();
        const textOutput = mJson.choices?.[0]?.message?.content;
        if (textOutput) {
          const parsedJson = JSON.parse(textOutput.trim());
          
          let generatedImageUrl = await tryGenerateMistralImage(
            style,
            roomType,
            parsedJson.summary,
            parsedJson.materials,
            mistralKey || "",
            userWishes,
            parsedJson.colorPalette,
            parsedJson.furnitureLayout
          );
          if (!generatedImageUrl) {
            generatedImageUrl = await tryGenerateGeminiImage(
              style,
              roomType,
              parsedJson.summary,
              parsedJson.materials,
              userWishes,
              base64Data,
              parsedJson.colorPalette,
              parsedJson.furnitureLayout
            );
          }

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
      } else {
        const errorText = await mResponse.text();
        console.warn(`[Mistral Fallback] Mistral API returned status ${mResponse.status}: ${errorText}. Gracefully switching to Google Gemini...`);
      }
    } catch (mErr: any) {
      console.warn(`[Mistral Fallback] Mistral call failed: ${mErr?.message || mErr}. Gracefully switching to Google Gemini...`);
    }
  }

  // 2. Google Gemini Execution (Primary / Graceful Fallback)
  if (ai) {
    try {
      const contentParts: any[] = [];
      if (base64Data) {
        contentParts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Data
          }
        });
      }
      
      const geminiPromptText = userWishes?.trim()
        ? `Analyzuj priloženú fotografiu izby a vygeneruj pre ňu moderný ${style} redizajn. Rozpočet je ${budget} EUR. Používateľ si želá v izbe: "${userWishes.trim()}". Odpovedaj detailne s nábytkom vo forme 2D mapy.`
        : `Analyzuj priloženú fotografiu izby a vygeneruj pre ňu moderný ${style} redizajn. Rozpočet je ${budget} EUR. Odpovedaj detailne s nábytkom vo forme 2D mapy.`;

      contentParts.push({
        text: geminiPromptText
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
      if (textOutput) {
        const parsedJson = JSON.parse(textOutput.trim());
        
        let generatedImageUrl = await tryGenerateGeminiImage(
          style,
          roomType,
          parsedJson.summary,
          parsedJson.materials,
          userWishes,
          base64Data,
          parsedJson.colorPalette,
          parsedJson.furnitureLayout
        );

        const promptLen = systemPrompt.length + (base64Data ? base64Data.length : 0);
        const respLen = textOutput.length;
        const inputTokens = Math.floor(promptLen / 4) + 200;
        const outputTokens = Math.floor(respLen / 4);

        return res.json({
          success: true,
          data: parsedJson,
          isSimulated: false,
          generatedImageUrl: generatedImageUrl,
          provider: "gemini",
          simulationMetrics: {
            geminiTokensInput: inputTokens,
            geminiTokensOutput: outputTokens,
            estimatedCostEur: (inputTokens * 0.00000015) + (outputTokens * 0.0000006)
          }
        });
      }
    } catch (geminiErr: any) {
      console.error("Gemini API error in redesign:", geminiErr);
      const isRateLimit = geminiErr.message?.includes("429") || geminiErr.message?.toLowerCase().includes("quota");
      if (isRateLimit) {
        return res.status(429).json({
          error: "Služba je momentálne vyťažená. Váš požiadavok prebehne automaticky o 15 sekúnd."
        });
      }
      console.warn("Gemini call hit an issue. Serving high-fidelity mock response fallback...");
    }
  }

  // 3. Resilient High-Fidelity Mock Response (Prevents any crash or blank state)
  console.log("Serving high-fidelity simulated response...");
  const mockData = getPremiumMockResponse(roomType, style, budget);
  if (userWishes?.trim()) {
    mockData.summary = `${mockData.summary} Návrh špeciálne zahŕňa vašu požiadavku: ${userWishes.trim()}.`;
    mockData.furnitureLayout.unshift({
      name: userWishes.trim().split(",")[0].trim(),
      category: "Dizajnový prvok",
      coordinateX: 50,
      coordinateY: 50,
      width: 140,
      depth: 85,
      estimatedPrice: Math.round(budget * 0.25),
      storeRecommendation: "Vlastná zákazková výroba",
      description: `Prvok navrhnutý presne podľa vašej špecifikácie: ${userWishes.trim()}`
    });
  }

  return res.json({
    success: true,
    data: mockData,
    isSimulated: true,
    simulationMetrics: {
      geminiTokensInput: 680,
      geminiTokensOutput: 345,
      estimatedCostEur: 0.00015
    },
    message: "Návrh pripravený v adaptívnom režime."
  });
});

// Curated high quality room fallbacks so app remains incredibly interactive and stunning without a key or when API fails
const ROOM_FALLBACKS: Record<string, string[]> = {
  default: [
    "https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?auto=format&fit=crop&w=1024&q=80",
    "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1024&q=80",
    "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1024&q=80"
  ],
  living: [
    "https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?auto=format&fit=crop&w=1024&q=80",
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1024&q=80",
    "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1024&q=80"
  ],
  bedroom: [
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1024&q=80",
    "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1024&q=80",
    "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=1024&q=80"
  ],
  kitchen: [
    "https://images.unsplash.com/photo-1556912173-3bb406ef7e77?auto=format&fit=crop&w=1024&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1024&q=80",
    "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1024&q=80"
  ],
  bathroom: [
    "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1024&q=80",
    "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=1024&q=80",
    "https://images.unsplash.com/photo-1604014237800-1c9102c219da?auto=format&fit=crop&w=1024&q=80"
  ]
};

function getRoomFallbackImage(prompt: string): string {
  let chosenCategory = "default";
  const lowerPrompt = (prompt || "").toLowerCase();
  if (lowerPrompt.includes("obýva") || lowerPrompt.includes("living") || lowerPrompt.includes("salon")) chosenCategory = "living";
  else if (lowerPrompt.includes("spál") || lowerPrompt.includes("bedroom") || lowerPrompt.includes("loznica")) chosenCategory = "bedroom";
  else if (lowerPrompt.includes("kuch") || lowerPrompt.includes("kitchen") || lowerPrompt.includes("varn")) chosenCategory = "kitchen";
  else if (lowerPrompt.includes("kúpel") || lowerPrompt.includes("bathroom") || lowerPrompt.includes("wc") || lowerPrompt.includes("van")) chosenCategory = "bathroom";

  const list = ROOM_FALLBACKS[chosenCategory] || ROOM_FALLBACKS.default;
  const imgIndex = Math.floor(Math.random() * list.length);
  return list[imgIndex];
}

// Endpoint to proxy Mistral Image Generations (Flux)
app.post("/api/generate-image", async (req, res) => {
  const { prompt, model, size, customKey, image } = req.body;

  if (!prompt || prompt.trim() === "") {
    return res.status(400).json({ error: "Chýba popisek (prompt) pre generovanie obrázku." });
  }

  // Choose appropriate key: custom input or server-configured
  const activeKey = (customKey && customKey.trim() !== "") 
    ? customKey 
    : (process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY);

  const selectedModel = model || "flux-pro";
  const selectedSize = size || "1024x1024";

  let base64ImageForGemini = "";
  if (image) {
    base64ImageForGemini = image.replace(/^data:image\/\w+;base64,/, "");
  }

  if (!activeKey || activeKey === "MY_MISTRAL_API_KEY" || activeKey.trim() === "") {
    console.log("[Mistral Proxy] No API Key provided. Executing dynamic original image generation via Google Imagen...");

    // Attempt Google dynamic image generation first
    const geminiUrl = await tryGenerateGeminiImage("Modern", "Interior", prompt, [], base64ImageForGemini);
    if (geminiUrl) {
      return res.json({
        success: true,
        url: geminiUrl,
        isSimulated: false,
        message: "Originálna premena vygenerovaná dynamicky pomocou Google Imagen."
      });
    }

    console.log("[Fallback] Google Imagen unavailable. Falling back to Unsplash static placeholders.");
    const mockUrl = getRoomFallbackImage(prompt);

    // Delay response to simulate image generation nicely
    await new Promise((resolve) => setTimeout(resolve, 1500));

    return res.json({
      success: true,
      url: mockUrl,
      isSimulated: true,
      message: "Vygenerované v testovacom režime (s replikou). Pre skutočné vizualizácie vložte Mistral API kľúč."
    });
  }

  try {
    const modelsToTry = selectedModel === "flux-pro" ? ["flux-pro", "flux-pro-latest"] : [selectedModel];
    let lastStatus = 200;
    let lastErrorText = "";

    for (const modelAttempt of modelsToTry) {
      console.log(`[Mistral Proxy] Calling Mistral API with model: ${modelAttempt}, size: ${selectedSize}`);
      const response = await fetch("https://api.mistral.ai/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${activeKey}`
        },
        body: JSON.stringify({
          model: modelAttempt,
          prompt: prompt,
          n: 1,
          size: selectedSize
        })
      });

      if (response.ok) {
        const resJson: any = await response.json();
        const url = resJson.data?.[0]?.url;
        if (url) {
          return res.json({
            success: true,
            url: url,
            isSimulated: false
          });
        }
      } else {
        lastStatus = response.status;
        lastErrorText = await response.text();
        console.error(`[Mistral Proxy State] Failure status ${lastStatus} for ${modelAttempt}: ${lastErrorText}`);
        
        // Try next fallback if it is a 404
        if (lastStatus === 404 && modelAttempt !== modelsToTry[modelsToTry.length - 1]) {
          console.log(`Model ${modelAttempt} not found. Retrying next model in fallback list...`);
          continue;
        }
        break;
      }
    }

    // Diagnostics for 404/403/401 errors
    let userFriendlyError = `Chyba Mistral API (Kód ${lastStatus}): ${lastErrorText || "Nepodarilo sa vygenerovať obrázok."}`;
    if (lastStatus === 404 || lastStatus === 403) {
      userFriendlyError = `Chyba Mistral API (Kód ${lastStatus}): Model alebo funkcia generovania obrázkov vyžaduje platený účet s aktívnou platobnou kartou a dostatočným kreditom na konzole Mistral la Plateforme. Bezplatné/skúšobné API kľúče nemajú prístup k prémiovým modelom série FLUX.1.`;
    } else if (lastStatus === 401) {
      userFriendlyError = `Chyba Mistral API (Kód 401): Váš zadaný kľúč Mistral API je neplatný alebo vypršala jeho platnosť. Overte si kľúč v nastaveniach la Plateforme.`;
    }

    // Dynamic Google Imagen Fallback on error to ensure a seamless premium user experience!
    console.log(`[Mistral Proxy Fallback] Mistral API failed with status ${lastStatus}. Falling back to dynamic Google Imagen...`);
    const geminiUrl = await tryGenerateGeminiImage("Modern", "Interior", prompt, [], base64ImageForGemini);
    if (geminiUrl) {
      return res.json({
        success: true,
        url: geminiUrl,
        isSimulated: false,
        message: `Mistral API vrátil chybu (Kód ${lastStatus}). Na zabezpečenie úspešnej premeny sme automaticky vygenerovali originálny návrh pomocou Google Imagen.`
      });
    }

    // High-quality curated room fallback so user UI is never broken or showing error
    const mockUrl = getRoomFallbackImage(prompt);
    return res.json({
      success: true,
      url: mockUrl,
      isSimulated: true,
      message: `${userFriendlyError} Zobrazujem náhľadový architektonický render.`
    });

  } catch (err: any) {
    console.error("[Mistral Proxy Error]:", err);
    return res.status(500).json({
      error: `Chyba pri kontaktovaní Mistral API: ${err.message || err}`
    });
  }
});

// Endpoint to automatically describe reference images using Gemini and auto-create Flux prompts
app.post("/api/describe-room", async (req, res) => {
  const { image, roomType, style, language, userWishes } = req.body;

  const defaultPrompt = buildUniversalRenderPrompt({
    roomType: roomType || "obývacia izba",
    style: style || "Swiss-Minimalist",
    userWishes: userWishes || "",
  });

  const ai = getGeminiClient();
  if (!ai) {
    return res.json({
      success: true,
      prompt: defaultPrompt,
      isSimulated: true,
      message: "Vytvorený univerzálny architektonický prompt s presným dodržaním rozmerov a vašich požiadaviek."
    });
  }

  try {
    const systemInstruction = `Si špičkový interiérový architekt a prompt inžinier pre modely generovania obrazu (Flux-Pro, Stable Diffusion, Imagen).
Tvojou úlohou je vygenerovať precízny univerzálny prompt v anglickom jazyku podľa tejto záväznej štruktúry:
1. "Highly realistic, photorealistic interior architectural design of the inside of this exact [typ miestnosti v angličtine]."
2. "SPATIAL FIDELITY ENFORCEMENT: Retain 100% of the original spatial geometry, including the exact ceiling borders, structural walls, window placement, door frames, and camera field of view from the reference picture. Absolutely no structural changes."
3. "DESIGN DIRECTIVE: Redesign and furnish the room using [architektonický štýl]. [Ak používateľ zadal špecifické požiadavky, striktne ich zahrň sem ako USER CUSTOM REQUIREMENTS]."
4. "MATERIALITY: Apply high-quality realistic materials like: [konkrétne prémiové materiály]."
5. "COLOR SCHEME: Apply this exact color palette: [harmonické HEX farby a odtiene]."
6. "LAYOUT: Cleanly furnish the space with: [zoznam nábytku s kategóriami]."
7. "RENDERING DETAILS: High-end architectural digest publication photo, realism, soft diffused warm light (2700K), captured on professional 35mm lens, atmospheric depth, realistic soft shadows, 8k resolution, photoreal. STRICTLY INDOOR SHOT, NO OUTDOOR SCENERY, NO EXTERIOR VIEW, PURE INTERNAL PHOTOGRAPH."
Nevracaj žiaden úvodný ani záverečný komentár, vráť iba samotný štruktúrovaný text promptu.`;

    const contentParts: any[] = [];

    if (image) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      contentParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data
        }
      });
    }

    const userPromptDirective = userWishes?.trim()
      ? `Analyzuj túto miestnosť (${roomType || "obývacia izba"}) a priprav pre ňu fotorealistický prompt v štýle ${style || "Swiss-Minimalist"}. Používateľ si výslovne želá v novom návrhu tieto prvky: "${userWishes.trim()}". Zakomponuj ich priamo do zoznamu prvkov LAYOUT a DESIGN DIRECTIVE.`
      : `Analyzuj túto miestnosť (${roomType || "obývacia izba"}) a priprav pre ňu fotorealistický prompt v štýle ${style || "Swiss-Minimalist"}.`;

    contentParts.push({
      text: userPromptDirective
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: contentParts },
      config: {
        systemInstruction,
        temperature: 0.4
      }
    });

    const textOutput = response.text;
    if (textOutput) {
      return res.json({
        success: true,
        prompt: textOutput.trim(),
        isSimulated: false
      });
    } else {
      throw new Error("Gemini API nevrátilo popis.");
    }
  } catch (err: any) {
    console.warn("Describe room error from Gemini, using high-fidelity fallback prompt:", err?.message || err);
    return res.json({
      success: true,
      prompt: defaultPrompt,
      isSimulated: true,
      message: "Vytvorený univerzálny fotorealistický prompt (Gemini API je dočasne vyťažené)."
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
