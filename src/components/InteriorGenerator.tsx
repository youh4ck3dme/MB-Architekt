/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Upload, 
  History, 
  Download, 
  Eye, 
  RotateCcw, 
  Sliders, 
  X, 
  Check, 
  Trash2, 
  ImageIcon, 
  Layers, 
  Info, 
  Maximize2, 
  ChevronRight,
  Shield,
  SlidersHorizontal,
  ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Subliminal loading thoughts during Flux generation
const FLUX_LOADING_STAGES = [
  "Formulujem priestorovú sémantiku...",
  "Vykresľujem fotorealistický nábytok...",
  "Presvetľujem scénu nepriamym slnečným jasom...",
  "Kalkulujem materiálové odrazy jaseňového dreva...",
  "Redukujem vizuálny šum pre čistý minimalistický záber...",
  "Vyvažujem rovnováhu negatívneho priestoru...",
  "Finálne ladenie kompozície v štýle Architectural Digest..."
];

interface GeneratedHistoryItem {
  id: string;
  prompt: string;
  originalImage: string | null;
  generatedImageUrl: string;
  roomType: string;
  style: string;
  colorPalette: string;
  lighting: string;
  model: string;
  size: string;
  createdAt: string;
}

export function InteriorGenerator() {
  // --- Form & Prompt States ---
  const [prompt, setPrompt] = useState("");
  const [roomType, setRoomType] = useState("Obývacia izba");
  const [style, setStyle] = useState("Swiss-Minimalist");
  const [colorPalette, setColorPalette] = useState("Svetlé tóny & Dub");
  const [lighting, setLighting] = useState("Popoludňajšie slnko");
  const [model, setModel] = useState("flux-pro");
  const [size, setSize] = useState("1024x1024"); // size mapped: Square (1024x1024), Wide (1024x768), Portrait (768x1024)

  // --- Reference Image Upload ---
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- UI Workspace Results ---
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSimulated, setIsSimulated] = useState(false);

  // --- Slider & Interactive Compare ---
  const [sliderPosition, setSliderPosition] = useState(50);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  
  // --- Custom API Key Setting Optional override ---
  const [customKey, setCustomKey] = useState(() => localStorage.getItem("custom_mistral_api_key") || "");
  const [showKeySetting, setShowKeySetting] = useState(false);

  // --- Local persistent History ---
  const [history, setHistory] = useState<GeneratedHistoryItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("flux_generation_history") || "[]");
    } catch {
      return [];
    }
  });

  // --- Gemini Descriptor / Enhancer Info ---
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceSuccess, setEnhanceSuccess] = useState(false);

  // Timer loop for loading slogans
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      setLoadingMsgIdx(0);
      timer = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % FLUX_LOADING_STAGES.length);
      }, 2500);
    }
    return () => clearInterval(timer);
  }, [loading]);

  // Sync custom key to storage
  const handleSaveCustomKey = (key: string) => {
    setCustomKey(key);
    if (key.trim() === "") {
      localStorage.removeItem("custom_mistral_api_key");
    } else {
      localStorage.setItem("custom_mistral_api_key", key.trim());
    }
  };

  // Process reference image locally
  const processImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Vyberte prosím platný súbor typu obrázok.");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Auto-scale to 800px max for faster server processing and storage
        let width = img.width;
        let height = img.height;
        const maxDim = 800;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const optimizedBase64 = canvas.toDataURL("image/jpeg", 0.75);
        setReferenceImage(optimizedBase64);
        setError(null);
      };
    };
  };

  // Drag handles
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => {
    setIsDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  // Quick prompt assembly helper
  const handleAppendKeyword = (word: string) => {
    setPrompt((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return word;
      if (trimmed.endsWith(".") || trimmed.endsWith(",")) return `${trimmed} ${word}`;
      return `${trimmed}, ${word}`;
    });
  };

  // Ask Gemini to analyze the reference room and construct a pristine visual prompt for Flux!
  const handleEnhancePromptWithGemini = async () => {
    setEnhancing(true);
    setError(null);
    setEnhanceSuccess(false);

    try {
      const resp = await fetch("/api/describe-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: referenceImage, // image description if uploaded
          roomType,
          style
        })
      });

      if (!resp.ok) {
        throw new Error("Nepodarilo sa skontaktovať analyzátor.");
      }

      const resJson = await resp.json();
      if (resJson.success && resJson.prompt) {
        setPrompt(resJson.prompt);
        setEnhanceSuccess(true);
        setTimeout(() => setEnhanceSuccess(false), 3000);
      } else {
        throw new Error(resJson.error || "Nevrátené žiadne dáta.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Zlyhalo automatické vylepšenie promptu. Môžete ho napísať manuálne.");
    } finally {
      setEnhancing(false);
    }
  };

  // Generate image trigger!
  const handleGenerateFluxImage = async () => {
    const finalPrompt = prompt.trim();
    if (!finalPrompt) {
      setError("Zadajte prosím popis (prompt) pre generovanie dizajnu.");
      return;
    }

    setLoading(true);
    setError(null);
    setIsSimulated(false);

    // Build optimized structural query incorporating room filters if user prompt doesn't cover them
    let augmentedPrompt = finalPrompt;
    const lowerPrompt = finalPrompt.toLowerCase();
    
    // Auto-augment filters for Flux if they aren't explicitly typed for visual quality preservation
    if (!lowerPrompt.includes(roomType.toLowerCase().substring(0, 5))) {
      augmentedPrompt = `A stunning redesigned ${roomType.toLowerCase()}, ${augmentedPrompt}`;
    }
    if (!lowerPrompt.includes(style.toLowerCase().substring(0, 5)) && style !== "Original") {
      augmentedPrompt = `${augmentedPrompt}, styled in ultra-premium luxury ${style} materials`;
    }
    if (!lowerPrompt.includes(colorPalette.toLowerCase().substring(0, 5))) {
      augmentedPrompt = `${augmentedPrompt}, color theme is based on ${colorPalette}`;
    }
    if (!lowerPrompt.includes(lighting.toLowerCase().substring(0, 5))) {
      augmentedPrompt = `${augmentedPrompt}, atmospheric lighting: ${lighting}`;
    }

    // Append technical details for immaculate photorealistic visual fidelity on Black Forest Labs model
    augmentedPrompt = `${augmentedPrompt}, interior architectural digest photograph, highly detailed furniture layout, ultra realistic texture, soft shadows, 8k, photorealism, strictly indoor view.`;

    try {
      const resp = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: augmentedPrompt,
          model: model,
          size: size,
          customKey: customKey
        })
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.error || `Chyba servera (Kód ${resp.status})`);
      }

      const resJson = await resp.json();
      if (resJson.success && resJson.url) {
        setGeneratedImageUrl(resJson.url);
        setIsSimulated(!!resJson.isSimulated);
        if (resJson.isSimulated) {
          setError("Pozor: Aplikácia beží v DEMO simulovanom stave, pretože chýba Mistral API kľúč. Zobrazujem ukážkový hotový interiér.");
        }

        // Add to history list
        const newHistoryItem: GeneratedHistoryItem = {
          id: "flux_" + Date.now(),
          prompt: finalPrompt,
          originalImage: referenceImage,
          generatedImageUrl: resJson.url,
          roomType,
          style,
          colorPalette,
          lighting,
          model,
          size,
          createdAt: new Date().toISOString()
        };

        setHistory((prev) => {
          const updated = [newHistoryItem, ...prev].slice(0, 24); // Keep last 24 generations
          localStorage.setItem("flux_generation_history", JSON.stringify(updated));
          return updated;
        });

      } else {
        throw new Error("Dáta z Mistral API neboli správne doručené.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Nepodarilo sa vygenerovať obrázok. Skontrolujte prosím pripojenie.");
    } finally {
      setLoading(false);
    }
  };

  // Restore history item to current workspace
  const handleSelectHistoryItem = (item: GeneratedHistoryItem) => {
    setPrompt(item.prompt);
    setReferenceImage(item.originalImage);
    setGeneratedImageUrl(item.generatedImageUrl);
    setRoomType(item.roomType);
    setStyle(item.style);
    setColorPalette(item.colorPalette);
    setLighting(item.lighting);
    setModel(item.model);
    setSize(item.size);
    setError(null);
  };

  // Delete history item
  const handleDeleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      localStorage.setItem("flux_generation_history", JSON.stringify(updated));
      return updated;
    });
  };

  // Clear visual workspace
  const handleResetWorkspace = () => {
    setPrompt("");
    setReferenceImage(null);
    setGeneratedImageUrl(null);
    setError(null);
    setIsSimulated(false);
  };

  // Toggle Custom API Override dropdown
  const handleToggleKeyOverride = () => {
    setShowKeySetting(!showKeySetting);
  };

  // Standard direct download of image
  const handleDownloadImage = async () => {
    if (!generatedImageUrl) return;
    try {
      // Create element and fire direct browser save
      const response = await fetch(generatedImageUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `flux_redizajn_${roomType.toLowerCase().replace(/\s+/g, "_")}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: Open in new window safely
      window.open(generatedImageUrl, "_blank");
    }
  };

  // Utility to handle slider dragging on visual comparison view
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const handleSliderMove = (clientX: number) => {
    if (!sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleSliderMove(e.touches[0].clientX);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.buttons === 1) {
      handleSliderMove(e.clientX);
    }
  };

  return (
    <div className="w-full space-y-8 animate-fade-in">
      
      {/* HEADER EXPLANATORY ROW */}
      <section className="bg-white border border-[#1C1C1C]/10 p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center space-x-2 text-[#D97706]">
            <Sparkles className="w-4 h-4" />
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">MISTRAL AI IMAGE RENDERER</span>
          </div>
          <h2 className="font-display font-medium text-lg text-gray-900 tracking-tight">
            Fotorealistický Generátor Premen (Flux)
          </h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            Vyrenderujte si fotorealistické návrhy interiérov na základe detailného textového opisu s využitím špičkového modelu <b>Flux-Pro</b> od Mistral AI. Nahrajte pôvodnú fotku bytu a posuňte ju cez pred & po posuvník!
          </p>
        </div>
        
        {/* API Key management panel quick access */}
        <div className="relative self-start md:self-center">
          <button 
            onClick={handleToggleKeyOverride}
            className={`flex items-center space-x-2 px-3.5 py-2 border text-[11px] font-mono uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              customKey ? "border-green-600 bg-green-50/50 text-green-800" : "border-[#1C1C1C]/10 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>{customKey ? "Vlastný kľúč aktívny" : "Nastaviť Mistral API Kľúč"}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showKeySetting ? "rotate-180" : ""}`} />
          </button>
          
          <AnimatePresence>
            {showKeySetting && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute right-0 mt-2 w-72 bg-white border border-[#1C1C1C] p-4 shadow-xl z-30"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-bold">Mistral API Kľúč (Console)</span>
                    <button onClick={() => setShowKeySetting(false)} className="text-gray-400 hover:text-black">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="password"
                    placeholder="MISTRAL_API_KEY..."
                    value={customKey}
                    onChange={(e) => handleSaveCustomKey(e.target.value)}
                    className="w-full border border-gray-200 p-2 text-xs font-mono outline-none focus:border-black"
                  />
                  <div className="text-[9px] text-gray-400 leading-normal">
                    <p>Uložené bezpečne iba vo vašom prehliadači (localStorage).</p>
                    <p className="mt-1">Ak kľúč nezadáte, aplikácia plynule prepne do <b>Demo režimu</b> so simulovanými ukážkovými obrázkami pre testovania.</p>
                  </div>
                  {customKey && (
                    <button
                      onClick={() => {
                        handleSaveCustomKey("");
                        setShowKeySetting(false);
                      }}
                      className="text-[9px] text-red-600 underline uppercase font-mono tracking-wider w-full text-right"
                    >
                      Odstrániť kľúč ✕
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* CORE CONFIGURATION BENTO GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 1. LEFT COLUMN: FORM CONTROLS (Width: 5/12) */}
        <section className="lg:col-span-5 bg-white border border-[#1C1C1C]/10 p-5 md:p-6 flex flex-col justify-between space-y-6 shadow-sm">
          
          <div className="space-y-5">
            <div className="pb-3 border-b border-[#1C1C1C]/10 flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-widest text-[#1C1C1C] font-semibold">KONFIGURÁCIA INTERIÉRU</span>
              <RotateCcw 
                onClick={handleResetWorkspace} 
                className="w-4 h-4 text-gray-400 hover:text-black cursor-pointer transition-colors" 
                title="Resetovať konfigurátor" 
              />
            </div>

            {/* A. Reference Room Photo Uploader (Drag & Drop) */}
            <div className="space-y-2">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-gray-500">
                A. Referenčný obrázok (Pôvodný priestor)
              </label>
              
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border border-dashed p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[120px] select-none ${
                  isDragging 
                    ? "border-black bg-gray-50" 
                    : referenceImage 
                    ? "border-green-600 bg-green-50/5" 
                    : "border-gray-200 hover:border-gray-400 bg-gray-50/30"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files && processImageFile(e.target.files[0])}
                  className="hidden"
                  accept="image/*"
                />

                {referenceImage ? (
                  <div className="flex items-center space-x-3 w-full text-left">
                    <img 
                      src={referenceImage} 
                      alt="Reference Room" 
                      className="w-14 h-14 object-cover border border-[#1C1C1C]/10" 
                    />
                    <div className="flex-1 min-w-0">
                      <span className="block text-[11px] font-semibold text-green-700 truncate">Súbor úspešne načítaný</span>
                      <span className="block text-[9px] text-gray-400 font-mono">Pripravený na PWA offline cache</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setReferenceImage(null);
                      }}
                      className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="w-5 h-5 text-gray-400 mb-1.5" />
                    <p className="text-[11px] font-medium text-gray-700">Presuňte sem pôvodnú fotku alebo kliknite</p>
                    <p className="text-[9px] text-gray-400 mt-0.5">Umožní detailnú pred & po porovnávaciu vizualizáciu</p>
                  </div>
                )}
              </div>
            </div>

            {/* B. Visual Style Toggles */}
            <div className="grid grid-cols-2 gap-4">
              
              {/* Room Selector */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono uppercase tracking-wider text-gray-500">Miestnosť</label>
                <div className="relative">
                  <select
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                    className="w-full text-xs bg-[#FAF9F6] border border-[#1C1C1C]/10 p-2.5 outline-none focus:border-black appearance-none"
                  >
                    {["Obývacia izba", "Spálňa", "Kuchyňa", "Kúpeľňa", "Predsieň", "Terasa"].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

              {/* Style Selector */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono uppercase tracking-wider text-gray-500 font-medium">Architektonický štýl</label>
                <div className="relative">
                  <select
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="w-full text-xs bg-[#FAF9F6] border border-[#1C1C1C]/10 p-2.5 outline-none focus:border-black appearance-none"
                  >
                    {["Swiss-Minimalist", "Japandi", "Industrial", "Nordic", "Cozy Hearth", "Modern Luxury"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

            </div>

            {/* C. Material & Color Schemes */}
            <div className="grid grid-cols-2 gap-4">
              
              {/* Color Scheme */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono uppercase tracking-wider text-gray-500">Tóny & Farby</label>
                <div className="relative">
                  <select
                    value={colorPalette}
                    onChange={(e) => setColorPalette(e.target.value)}
                    className="w-full text-xs bg-[#FAF9F6] border border-[#1C1C1C]/10 p-2.5 outline-none focus:border-black appearance-none"
                  >
                    {["Svetlé tóny & Dub", "Smaragd & Orech", "Betón & Chrómovaná oceľ", "Hlina & Terakota", "Monochromatická Čierna"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

              {/* Lighting */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono uppercase tracking-wider text-gray-500 font-medium">Schéma osvetlenia</label>
                <div className="relative">
                  <select
                    value={lighting}
                    onChange={(e) => setLighting(e.target.value)}
                    className="w-full text-xs bg-[#FAF9F6] border border-[#1C1C1C]/10 p-2.5 outline-none focus:border-black appearance-none"
                  >
                    {["Popoludňajšie slnko", "Západ Slnka (Zlatá hodinka)", "Tlmené severské biele svetlo", "Scénické LED línie", "Mystická nočná atmosféra"].map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

            </div>

            {/* D. Aspect Ratio Selector mapped to sizes */}
            <div className="space-y-2">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-gray-500">Mierka (Aspect Ratio)</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Štvorec (1:1)", val: "1024x1024" },
                  { label: "Na Šírku (4:3)", val: "1024x768" },
                  { label: "Na Výšku (3:4)", val: "768x1024" }
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setSize(item.val)}
                    className={`py-2 text-[11px] font-mono border transition-colors ${
                      size === item.val
                        ? "bg-[#1C1C1C] border-[#1C1C1C] text-white"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* E. Flux Prompt Textarea with Gemini Enhancer Button */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-mono uppercase tracking-wider text-gray-500 font-medium">
                  Popis premeny (Prompt)
                </label>
                <button
                  type="button"
                  onClick={handleEnhancePromptWithGemini}
                  disabled={enhancing}
                  className={`flex items-center space-x-1.5 px-2 py-1 text-[9px] font-mono uppercase border transition-colors cursor-pointer ${
                    enhanceSuccess 
                      ? "bg-green-100 text-green-800 border-green-200" 
                      : "bg-[#1C1C1C]/5 hover:bg-[#1C1C1C]/10 text-gray-700 border-[#1C1C1C]/10"
                  }`}
                  title="Doplní a vylepší váš opis pomocou analýzy v Gemini"
                >
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  <span>{enhancing ? "Vylepšujem..." : enhanceSuccess ? "Vylepšené!" : "Vylepšiť Cez AI"}</span>
                </button>
              </div>
              
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Popíšte svoju vysnívanú interiérovú premenu, napr.: Moderná obývačka s masívnym svetlým dubovým nábytkom, biele dymové omietky, útulný svetlosivý koberec, veľká dizajnová váza, rastliny, v pozadí zapadajúce slnko..."
                className="w-full min-h-[100px] border border-gray-200 p-3 text-xs outline-none focus:border-black resize-y leading-relaxed bg-[#FAF9F6]/30"
              />

              {/* Quick Append Keywords suggestions */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[9px] font-mono text-gray-400 lowercase self-center mr-1">Rýchle tóny:</span>
                {[
                  "+ drevená podlaha", 
                  "+ veľké loft okná", 
                  "+ minimalistické krbové teleso", 
                  "+ béžový boucle gauč",
                  "+ izbová zeleň",
                  "+ dizajnová lampa"
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleAppendKeyword(tag.substring(2))}
                    className="text-[9px] font-mono bg-[#FAF9F6] border border-gray-200 hover:border-black/30 px-2 py-1 text-gray-600 focus:outline-none transition-all cursor-pointer rounded-sm"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Action Generate Button */}
          <div className="pt-4 border-t border-[#1C1C1C]/10 space-y-3">
            {error && (
              <div className="bg-red-50 border-l-2 border-red-500 p-3">
                <p className="text-[10px] text-red-700 font-mono leading-normal">{error}</p>
              </div>
            )}
            
            <button
              onClick={handleGenerateFluxImage}
              disabled={loading}
              className="w-full bg-[#1C1C1C] hover:bg-black text-[#FAF9F6] disabled:bg-gray-200 disabled:text-gray-400 py-3 text-xs font-mono uppercase tracking-widest transition-all cursor-pointer text-center"
            >
              {loading ? "Generujem render..." : "Vyrenderovať premenu (Flux)"}
            </button>
          </div>

        </section>

        {/* 2. RIGHT COLUMN: INTERACTIVE VISUALIZER WORKSPACE (Width: 7/12) */}
        <section className="lg:col-span-7 bg-white border border-[#1C1C1C]/10 flex flex-col justify-between overflow-hidden shadow-sm relative min-h-[480px]">
          
          {/* A. Loading Visual Block */}
          {loading && (
            <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-8 z-20 select-none">
              <div className="w-14 h-14 border border-[#1C1C1C]/10 flex items-center justify-center mb-5 relative">
                <div className="absolute inset-0 border-2 border-t-[#1C1C1C] border-b-transparent border-l-transparent border-r-transparent animate-spin" />
                <Sparkles className="w-5 h-5 text-amber-600 animate-pulse" />
              </div>
              <p className="font-mono text-xs text-black uppercase tracking-wider mb-2">Pripravujem render</p>
              <div className="w-48 h-1 bg-gray-100 overflow-hidden relative mb-5">
                <motion.div 
                  initial={{ left: "-100%" }}
                  animate={{ left: "100%" }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                  className="absolute top-0 bottom-0 w-24 bg-black"
                />
              </div>
              <AnimatePresence mode="wait">
                <motion.span
                  key={loadingMsgIdx}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.3 }}
                  className="text-[10px] md:text-xs font-mono text-gray-400 italic text-center max-w-xs"
                >
                  {FLUX_LOADING_STAGES[loadingMsgIdx]}
                </motion.span>
              </AnimatePresence>
            </div>
          )}

          {/* B. Main Visual Canvas View */}
          <div className="flex-1 flex flex-col justify-center bg-gray-50/50 p-4 min-h-[380px] relative">
            
            {!generatedImageUrl ? (
              <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-[#1C1C1C]/5 m-4 bg-white min-h-[320px]">
                <div className="w-12 h-12 bg-[#FAF9F6] border border-[#1C1C1C]/5 flex items-center justify-center text-gray-400 mb-4 rounded-full">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-mono uppercase tracking-widest text-[#1C1C1C] font-semibold mb-1">VOĽNÉ PLÁTNO REALITY</h4>
                <p className="text-[11px] text-gray-400 max-w-md leading-relaxed">
                  Zadajte parametre premeny vľavo, voliteľne nahrajte referenčnú fotku a stlačte <b>Vyrenderovať premenu</b>.
                </p>
                {referenceImage && (
                  <div className="mt-4 p-2 bg-green-50 border border-green-200/50 flex items-center space-x-2">
                    <Check className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-[10px] text-green-800 font-mono">Referenčné foto pripravené na prekrývanie sliderom.</span>
                  </div>
                )}
              </div>
            ) : (
              // B.1 Rendering visual results in comparative forms
              <div className="w-full h-full max-w-xl mx-auto flex flex-col justify-center">
                
                {referenceImage ? (
                  // Elegant slide comparison slider
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[9px] font-mono text-gray-400 uppercase">← PÔVODNÝ BYT (PRED)</span>
                      <span className="text-[9px] font-mono text-[#D97706] uppercase">MISTRAL LUX FLUX (PO) →</span>
                    </div>

                    <div 
                      ref={sliderContainerRef}
                      onMouseMove={handleMouseMove}
                      onTouchMove={handleTouchMove}
                      onMouseDown={(e) => handleSliderMove(e.clientX)}
                      className="relative w-full aspect-square md:aspect-video select-none cursor-ew-resize overflow-hidden border border-[#1C1C1C]/10 shadow-lg bg-white"
                    >
                      {/* After Image: background */}
                      <img 
                        src={generatedImageUrl} 
                        alt="Restyled Room" 
                        className="absolute inset-0 w-full h-full object-cover pointer-events-none" 
                        referrerPolicy="no-referrer"
                      />

                      {/* Before Image: overlay clipper */}
                      <div 
                        className="absolute inset-y-0 left-0 overflow-hidden pointer-events-none"
                        style={{ width: `${sliderPosition}%` }}
                      >
                        <img 
                          src={referenceImage} 
                          alt="Original Room" 
                          className="absolute inset-0 w-full h-full object-cover max-w-none pointer-events-none" 
                          style={{ width: sliderContainerRef.current?.getBoundingClientRect().width || "100%" }}
                        />
                      </div>

                      {/* Drag Handle Bar Line */}
                      <div 
                        className="absolute inset-y-0 w-0.5 bg-white shadow-xl z-10 pointer-events-none"
                        style={{ left: `${sliderPosition}%` }}
                      >
                        {/* Drag Handle Ring */}
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 bg-[#1C1C1C] text-white rounded-full flex items-center justify-center border-2 border-white pointer-events-none shadow-md">
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-normal text-center select-none italic pt-1">
                      Ťahaním posuvníka prechádzate cez pôvodnú referenciu a nový vyrenderovaný model.
                    </p>
                  </div>
                ) : (
                  // Display generated image directly
                  <div className="relative border border-[#1C1C1C]/10 shadow-md">
                    <img 
                      src={generatedImageUrl} 
                      alt="Flux interior redesign" 
                      className="w-full h-auto object-cover" 
                      referrerPolicy="no-referrer"
                    />
                    {isSimulated && (
                      <div className="absolute top-3 left-3 bg-[#D97706] text-white px-2 py-0.5 text-[9px] font-mono uppercase rounded-sm">
                        Simulované Demo (Bez Kľúča)
                      </div>
                    )}
                  </div>
                )}
                
              </div>
            )}

          </div>

          {/* C. Interactive Drawer Toolbar */}
          <div className="bg-[#FAF9F6] border-t border-[#1C1C1C]/10 p-4 shrink-0 flex items-center justify-between flex-wrap gap-4">
            
            <div className="flex items-center space-x-1 font-mono text-[10px] text-gray-400 uppercase">
              {generatedImageUrl && (
                <>
                  <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  <span>Rozmer: {size}  |  Štýl: {style}</span>
                </>
              )}
            </div>

            {generatedImageUrl && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setFullscreenImage(generatedImageUrl)}
                  className="bg-white border border-gray-200 hover:border-black p-2 text-gray-600 hover:text-black transition-colors rounded-sm flex items-center justify-center cursor-pointer"
                  title="Zväčšiť na celú obrazovku"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleDownloadImage}
                  className="bg-[#1C1C1C] hover:bg-black text-white px-3.5 py-1.5 text-[11px] font-mono uppercase tracking-wider flex items-center space-x-2 hover:opacity-90 transition-opacity cursor-pointer rounded-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Stiahnuť render</span>
                </button>
              </div>
            )}

          </div>

        </section>

      </div>

      {/* 3. HISTORY & EXPLANATORY SECTION BENTO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
        
        {/* A. LOCAL GENERATION HISTORY PANEL (Width: 6/12) */}
        <section className="lg:col-span-6 bg-white border border-[#1C1C1C]/10 p-5 md:p-6 shadow-sm flex flex-col space-y-4">
          <div className="pb-3 border-b border-[#1C1C1C]/10 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <History className="w-4 h-4 text-gray-500" />
              <span className="text-xs font-mono uppercase tracking-widest text-[#1C1C1C] font-semibold">HISTÓRIA GENEROVANIA</span>
            </div>
            {history.length > 0 && (
              <button 
                onClick={() => {
                  setHistory([]);
                  localStorage.removeItem("flux_generation_history");
                }}
                className="text-[10px] text-red-500 hover:text-red-700 font-mono uppercase tracking-wider underline cursor-pointer"
              >
                Vyčistiť históriu ✕
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="text-center p-8 border border-dashed border-gray-100 bg-gray-50/20">
              <History className="w-6 h-6 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Nemáte zatiaľ žiadne uložené premeny.</p>
              <p className="text-[10px] text-gray-400 mt-1">Všetky úspešné Flux rendery sa ukladajú offline sem do prehliadača.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectHistoryItem(item)}
                  className="flex bg-[#FAF9F6] border border-[#1C1C1C]/5 hover:border-black/30 p-2 cursor-pointer transition-all hover:shadow-sm select-none items-center relative group shrink-0"
                >
                  <img 
                    src={item.generatedImageUrl} 
                    alt="History Render" 
                    className="w-14 h-14 object-cover border border-[#1C1C1C]/10 mr-3 shrink-0" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-semibold text-gray-800 uppercase tracking-tight block truncate">
                      {item.roomType}
                    </span>
                    <span className="block text-[9px] text-gray-400 font-mono tracking-wide mt-0.5 uppercase truncate">
                      Štýl: {item.style}
                    </span>
                    <span className="block text-[8px] text-gray-400 font-mono block truncate mt-0.5 italic">
                      {item.prompt}
                    </span>
                  </div>

                  <button
                    onClick={(e) => handleDeleteHistoryItem(e, item.id)}
                    className="absolute top-2 right-2 text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                    title="Odstrániť z histórie"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* B. TECHNICAL EXPLANATIONS / PWA GUIDE (Width: 6/12) */}
        <section className="lg:col-span-6 bg-white border border-[#1C1C1C]/10 p-5 md:p-6 shadow-sm space-y-4">
          <div className="pb-3 border-b border-[#1C1C1C]/10 flex items-center space-x-2">
            <Info className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-mono uppercase tracking-widest text-[#1C1C1C] font-semibold">AKO TO FUNGUJE & PWA SETUP</span>
          </div>

          <div className="space-y-3.5 text-xs text-gray-600 leading-relaxed">
            
            <div className="space-y-1">
              <strong className="block font-semibold text-gray-900 font-mono text-[11px] uppercase tracking-wide">1. Integrácia s Mistral Flux API</strong>
              <p>
                Každé kliknutie na formulár posiela zabezpečený request cez náš interný Express server priamo na endpoint <code>POST https://api.mistral.ai/v1/images/generations</code>. Spracovaný prompt kombinuje vami vybrané parametre do detailného anglického popisu na dosiahnutie neuveriteľnej hĺbky a fotorealizmu cez špičkový model <b>Flux-Pro</b>.
              </p>
            </div>

            <div className="space-y-1">
              <strong className="block font-semibold text-gray-900 font-mono text-[11px] uppercase tracking-wide">2. PWA Mobilná Inštalácia & Offline</strong>
              <p>
                Tento systém je vybavený plnou PWA konfiguráciou:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-gray-500">
                <li>Na mobilných zariadeniach alebo notebookoch sa zobrazí výzva na inštaláciu aplikácie na plochu.</li>
                <li>Vytvorený <code>manifest.json</code> so sadou vysokokvalitných ikon zabezpečuje plynulý chod v samostatnom okne (Standalone).</li>
                <li>Service worker <code>sw.js</code> ukladá potrebné statické assety chodu do vyrovnávacej pamäte, čo garantuje rýchle načítanie bez sieťového internetu.</li>
              </ul>
            </div>

            <div className="space-y-1">
              <strong className="block font-semibold text-gray-900 font-mono text-[11px] uppercase tracking-wide">3. Generovanie v Demo režime</strong>
              <p>
                Nemáte momentálne poruke vlastný kľúč? Žiadny problém! Aplikácia deteguje chýbajúci API kľúč a plynule prejde do elegantného <b>Demo simulátora</b>. To vám umožní vyskúšať celé rozhranie, posuvník aj históriu s precízne vybranými ukážkami.
              </p>
            </div>

          </div>
        </section>

      </div>

      {/* FULLSCREEN LIGHTBOX DIALOG */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setFullscreenImage(null)}
          >
            <button 
              onClick={() => setFullscreenImage(null)} 
              className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 p-2 text-xs font-mono uppercase tracking-widest cursor-pointer"
            >
              Zavrieť ✕
            </button>
            <img 
              src={fullscreenImage} 
              alt="Design Fullscreen" 
              className="max-w-full max-h-[90vh] object-contain select-none"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
