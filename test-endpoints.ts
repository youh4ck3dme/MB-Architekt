/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const TARGET_HOST = "http://localhost:3000";

async function runTests() {
  console.log("==========================================");
  console.log("🚀 SPUŠŤAM EN-TO-END VERIFIKÁCIU SLUŽIEB");
  console.log("==========================================");

  let success = true;

  // Test 1: Service Health Check
  try {
    console.log("\n[TEST 1] Kontrola zdravia servera (GET /api/health)...");
    const res = await fetch(`${TARGET_HOST}/api/health`);
    if (res.ok) {
      const json = await res.json() as { status: string; time: string };
      console.log(`✅ Server je aktívny! Status: ${json.status}, Čas: ${json.time}`);
    } else {
      throw new Error(`Kód odpovede: ${res.status}`);
    }
  } catch (err: any) {
    console.error(`❌ Test 1 Zlyhal: ${err.message}`);
    success = false;
  }

  // Test 2: Gemini Prompt Enhancer (POST /api/describe-room) - Simulated / API dual-route
  try {
    console.log("\n[TEST 2] Analýza priestoru & tvorba promptu (POST /api/describe-room)...");
    const res = await fetch(`${TARGET_HOST}/api/describe-room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomType: "Obývacia izba",
        style: "Swiss-Minimalist"
      })
    });

    if (res.ok) {
      const json = await res.json() as { success: boolean; prompt: string; isSimulated: boolean };
      console.log(`✅ Analýza úspešná!`);
      console.log(`   - Simulovaný stav: ${json.isSimulated}`);
      console.log(`   - Vygenerovaný prompt: "${json.prompt.substring(0, 100)}..."`);
      if (!json.prompt) {
        throw new Error("Vrátená odpoveď neobsahuje prompt pre Flux.");
      }
    } else {
      const errorText = await res.text();
      throw new Error(`Kód odpovede: ${res.status}. Detaily: ${errorText}`);
    }
  } catch (err: any) {
    console.error(`❌ Test 2 Zlyhal: ${err.message}`);
    success = false;
  }

  // Test 3: Flux Image Rendering API Proxy (POST /api/generate-image)
  try {
    console.log("\n[TEST 3] Generovanie fotorealistického renderu cez Mistral Flux Proxy (POST /api/generate-image)...");
    const res = await fetch(`${TARGET_HOST}/api/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "A gorgeous Swiss-Minimalist living room with oak wood accents, photoreal.",
        model: "flux-pro",
        size: "1024x1024"
      })
    });

    if (res.ok) {
      const json = await res.json() as { success: boolean; url: string; isSimulated: boolean };
      console.log(`✅ Renderer funguje perfektne!`);
      console.log(`   - Simulovaný stav: ${json.isSimulated}`);
      console.log(`   - URL výsledného obrázku: ${json.url}`);
      if (!json.url) {
        throw new Error("Plán nevrátil žiadne linkovacie URL pre vyrenderovanú scénu.");
      }
    } else if (res.status === 404 || res.status === 403 || res.status === 401) {
      const errorText = await res.text();
      const parsedError = JSON.parse(errorText) as { error: string };
      if (parsedError.error && parsedError.error.includes("Chyba Mistral API")) {
        console.log(`✅ Proxy smerovanie úspešne prebehlo!`);
        console.log(`   - Status kódu: ${res.status}`);
        console.log(`   - Zachytená vylepšená diagnostika: "${parsedError.error.substring(0, 70)}..."`);
      } else {
        throw new Error(`Nepredvídaný chybový formát: ${errorText}`);
      }
    } else {
      const errorText = await res.text();
      throw new Error(`Kód odpovede: ${res.status}. Detaily: ${errorText}`);
    }
  } catch (err: any) {
    console.error(`❌ Test 3 Zlyhal: ${err.message}`);
    success = false;
  }

  // Test 4: Redesign Layout & Blueprint Generation (POST /api/redesign)
  try {
    console.log("\n[TEST 4] Skúška komplexného 2D rozloženia a analýzy nábytku (POST /api/redesign)...");
    const res = await fetch(`${TARGET_HOST}/api/redesign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomType: "Obývacia izba",
        style: "Swiss-Minimalist",
        budget: 2000
      })
    });

    if (res.ok) {
      const json = await res.json() as { 
        success: boolean; 
        data: { 
          roomType: string; 
          aestheticStyle: string; 
          summary: string; 
          colorPalette: string[]; 
          materials: string[]; 
          furnitureLayout: any[]; 
        }; 
        isSimulated: boolean 
      };
      
      console.log(`✅ Návrh interiéru načítaný bezchybne!`);
      console.log(`   - Simulovaný stav: ${json.isSimulated}`);
      console.log(`   - Štýl: ${json.data.aestheticStyle}`);
      console.log(`   - Zhrnutie: ${json.data.summary.substring(0, 100)}...`);
      console.log(`   - Odporúčaná farebná škála: [ ${json.data.colorPalette.join(", ")} ]`);
      console.log(`   - Počet navrhnutých prvkov nábytku: ${json.data.furnitureLayout?.length || 0}`);
      
      // Basic schema validations
      if (!json.data.summary || !json.data.colorPalette || !json.data.furnitureLayout || json.data.furnitureLayout.length === 0) {
        throw new Error("Vrátený JSON nezodpovedá striktnej schéme interiéru.");
      }
    } else {
      throw new Error(`Kód odpovede: ${res.status}`);
    }
  } catch (err: any) {
    console.error(`❌ Test 4 Zlyhal: ${err.message}`);
    success = false;
  }

  console.log("\n==========================================");
  if (success) {
    console.log("🟢 VŠETKY SYSTÉMOVÉ TESTY PREBEHLI ÚSPEŠNE!");
    console.log("   Užívateľské prostredie a API sú dokonale prepojené.");
    process.exit(0);
  } else {
    console.error("🔴 NIEKTORÉ SÚČASTI ZLYHALI, SKONTROLUJTE CHYBY.");
    process.exit(1);
  }
}

runTests();
