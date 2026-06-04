/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Building, 
  Upload, 
  Sparkles, 
  Layers, 
  MapPin, 
  ShoppingBag, 
  AlertTriangle, 
  RotateCcw, 
  HelpCircle, 
  Database, 
  Cpu, 
  LogOut, 
  ChevronRight, 
  Coins,
  History,
  Trash2,
  FileText,
  Download,
  Eye,
  Image as ImageIcon,
  Copy,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { isFirebaseConfigured, auth, loginAnonymously, loginWithGoogle, OperationType } from "./lib/firebase";
import { StorageService } from "./lib/storage";
import { DesignBoard, UserProfile, CostMetrics, RoomAnalysisResult, FurnitureLayoutItem } from "./types";
import { jsPDF } from "jspdf";

// Dynamic motivation messages during loading
const SUBLIMINAL_MESSAGES = [
  "Prebieha redukcia vizuálneho sumu...",
  "Optimalizujem svetelné diagramy z hľadiska hrejivosti...",
  "Organizujem nábytkové moduly na 2D pôdoryse...",
  "Štylizujem prostredie na Swiss-Minimalistický tón...",
  "Vyvažujem materiálové zloženia a textúry...",
  "Zostavujem nákupný zoznam s dodržaním rozpočtovej disciplíny...",
  "Vytváram vyvážený negatívny priestor..."
];

export default function App() {
  return (
    <ErrorBoundary>
      <MainDashboard />
    </ErrorBoundary>
  );
}

const AFTER_IMAGES_MAPPING: Record<string, Record<string, string>> = {
  "Obývacia izba": {
    "Swiss-Minimalist": "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80",
    "Japandi": "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=80",
    "Nordic": "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1200&q=80",
    "Industrial": "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=1200&q=80"
  },
  "Spálňa": {
    "Swiss-Minimalist": "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
    "Japandi": "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1200&q=80",
    "Nordic": "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1200&q=80",
    "Industrial": "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=1200&q=80"
  },
  "Kuchyňa": {
    "Swiss-Minimalist": "https://images.unsplash.com/photo-1556912173-3bb406ef7e77?auto=format&fit=crop&w=1200&q=80",
    "Japandi": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
    "Nordic": "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80",
    "Industrial": "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=80"
  },
  "Kúpeľňa": {
    "Swiss-Minimalist": "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80",
    "Japandi": "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=1200&q=80",
    "Nordic": "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80",
    "Industrial": "https://images.unsplash.com/photo-1604014237800-1c9102c219da?auto=format&fit=crop&w=1200&q=80"
  }
};

function MainDashboard() {
  // Authentication states
  const [user, setUser] = useState<{ uid: string; displayName: string; email: string; isAnonymous: boolean } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Form states
  const [roomType, setRoomType] = useState("Obývacia izba");
  const [style, setStyle] = useState("Swiss-Minimalist");
  const [budget, setBudget] = useState(2500);
  const [provider, setProvider] = useState<"gemini" | "mistral">("gemini");
  const [uploadProgress, setUploadProgress] = useState<{ originalSize: string; compressedSize: string; savedPercent: number } | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // UI views & outputs
  const [activeTab, setActiveTab] = useState<"analysis" | "blueprint" | "shopping" | "visual-compare">("visual-compare");
  const [customAfterUrl, setCustomAfterUrl] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [compareMode, setCompareMode] = useState<"split" | "overlay">("split");
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [isExportingComparison, setIsExportingComparison] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<RoomAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [hoveredFurniture, setHoveredFurniture] = useState<FurnitureLayoutItem | null>(null);
  const [selectedFurniture, setSelectedFurniture] = useState<FurnitureLayoutItem | null>(null);

  // History & Metrics
  const [historyBoards, setHistoryBoards] = useState<DesignBoard[]>([]);
  const [metrics, setMetrics] = useState<CostMetrics>(StorageService.getMetrics());

  // Resiliency and HTTP 429 banner
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(15);
  const [retryTimerActive, setRetryTimerActive] = useState(false);

  // Input file reference
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Prompt generator for external image generator testing matching dimensions
  const generateImgPrompt = () => {
    const sDesc = style === "Swiss-Minimalist" 
      ? "Swiss-Minimalist architecture, clean strict grid alignment, extreme physical discipline, tactile concrete wall panels paired with light bleached oak wood cabinets, pure focus on empty intervals (negative space), and high-end built-in ambient lighting"
      : style === "Japandi"
      ? "warm Japandi interior style, organic curves combined with strict Scandinavian functionalism, soft clay plaster walls, low solid timber platform furniture, tactile cream linen fabrics, delicate hanging washi paper rice lanterns"
      : "cozy Scandinavian Nordic feel, whitewashed rustic wood flooring, bright airy northern daylight, pale light pine accents, cozy brushed wool throws, and simple matte black architectural hardware";
      
    const mats = analysisResult?.materials ? analysisResult.materials.join(", ") : "premium natural resources, sustainable materials";
    const colors = analysisResult?.colorPalette ? analysisResult.colorPalette.join(", ") : "well-balanced monochromatic palette";
    
    return `Interior architectural photorealistic design of this exact ${roomType.toLowerCase()}. 
SPATIAL FIDELITY ENFORCEMENT: Retain 100% of the original spatial geometry, including the exact ceiling borders, structural walls, window placement, door frames, and camera field of view from the reference picture. Absolutely no structural changes.
DESIGN DIRECTIVE: Redesign and furnish the room using ${sDesc}.
MATERIALITY: Apply high-quality realistic materials like: ${mats}.
COLOR SCHEME: Apply this exact color palette: ${colors}.
LAYOUT: Cleanly furnish the space with: ${analysisResult?.furnitureLayout ? analysisResult.furnitureLayout.map(f => `${f.name} in category ${f.category}`).join(", ") : "minimal clean pieces"}.
RENDERING DETAILS: High-end architectural digest publication photo, realism, soft diffused warm light (2700K), captured on professional 35mm lens, atmospheric depth, realistic soft shadows, 8k resolution, photoreal --ar 16:9 --v 6.0`;
  };

  // Initialize and check persistent auth
  useEffect(() => {
    // Check if dynamic unauthenticated bypass UID exists in local storage
    let storedUid = localStorage.getItem("ai_bypass_guest_uid");
    if (!storedUid) {
      storedUid = "guest_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("ai_bypass_guest_uid", storedUid);
    }

    if (isFirebaseConfigured && auth) {
      const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
        if (firebaseUser) {
          const u = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || "Používateľ dizajnu",
            email: firebaseUser.email || "cloud_user@google.com",
            isAnonymous: firebaseUser.isAnonymous,
          };
          setUser(u);
          const p = await StorageService.loadUserProfile(firebaseUser.uid);
          setProfile(p);
          const boards = await StorageService.loadDesignBoards(firebaseUser.uid);
          setHistoryBoards(boards);
        } else {
          // Fallback to guest mode
          setupGuestSession(storedUid!);
        }
        setAuthLoading(false);
      });
      return () => unsubscribe();
    } else {
      // Automatic Local guest mode
      setupGuestSession(storedUid);
      setAuthLoading(false);
    }
  }, []);

  // Set up local guest info
  const setupGuestSession = async (guestUid: string) => {
    const u = {
      uid: guestUid,
      displayName: "Anonymný Hosť (Bypass)",
      email: "host@obidenie.sk",
      isAnonymous: true,
    };
    setUser(u);
    const p = await StorageService.loadUserProfile(guestUid);
    setProfile(p);
    const boards = await StorageService.loadDesignBoards(guestUid);
    setHistoryBoards(boards);
  };

  // Re-synchronize metrics on demand
  const syncMetrics = () => {
    setMetrics(StorageService.getMetrics());
  };

  // Trigger Google login popup
  const handleGoogleLogin = async () => {
    try {
      setAuthLoading(true);
      setErrorBanner(null);
      await loginWithGoogle();
    } catch (err: any) {
      setErrorBanner(`Prihlásenie zlyhalo: ${err.message || err}`);
      setAuthLoading(false);
    }
  };

  // Bypass authentication trigger (for development/ Spark resiliency verification)
  const handleBypassGuestLogin = async () => {
    try {
      setAuthLoading(true);
      setErrorBanner(null);
      const storedUid = localStorage.getItem("ai_bypass_guest_uid") || "guest_fixed_bypass";
      await setupGuestSession(storedUid);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (isFirebaseConfigured && auth) {
      await auth.signOut();
    }
    const storedUid = localStorage.getItem("ai_bypass_guest_uid") || "guest_logout_renew";
    setupGuestSession(storedUid);
  };

  // Loading animation sequence & progress indicator simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let progressInterval: NodeJS.Timeout;
    if (loading) {
      setProgress(5);
      setLoadingMessageIndex(0);
      interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % SUBLIMINAL_MESSAGES.length);
      }, 2500);

      // Non-linear progress simulation
      progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev < 30) return Number((prev + Math.random() * 8 + 4).toFixed(1)); // fast up to 30
          if (prev < 65) return Number((prev + Math.random() * 3 + 1.2).toFixed(1)); // medium up to 65
          if (prev < 88) return Number((prev + Math.random() * 1.5 + 0.4).toFixed(1)); // slower up to 88
          if (prev < 98) return Number((prev + Math.random() * 0.4 + 0.1).toFixed(1)); // very slow crawl near the end
          return prev;
        });
      }, 400);
    } else {
      setProgress(0);
    }
    return () => {
      clearInterval(interval);
      clearInterval(progressInterval);
    };
  }, [loading]);

  // Automated HTTP 429 countdown ticker
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (retryTimerActive && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((c) => c - 1);
      }, 1000);
    } else if (countdown === 0 && retryTimerActive) {
      // Trigger retry automatically!
      setRetryTimerActive(false);
      setErrorBanner(null);
      handleSubmitRedesign();
    }
    return () => clearTimeout(timer);
  }, [retryTimerActive, countdown]);

  // Client-Side Image resizing/compression utility (max 1024px @ 0.7 quality)
  const processImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorBanner("Vyberte prosím platný súbor typu obrázok.");
      return;
    }

    const origSizeKB = (file.size / 1024).toFixed(1) + " KB";
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let width = img.width;
        let height = img.height;
        const maxDimension = 1024;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.fillStyle = "#FFFFFF"; // Backing color to avoid PNG transparent alpha problems
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Compress compression ratio as requested for Gemini TPM limits reduction!
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
        const compSizeKB = (compressedBase64.length * 0.75 / 1024).toFixed(1) + " KB";
        const savedPercent = Math.round((1 - (compressedBase64.length / (event.target?.result as string).length)) * 100);

        setImageSrc(compressedBase64);
        setUploadProgress({
          originalSize: origSizeKB,
          compressedSize: compSizeKB,
          savedPercent: savedPercent > 0 ? savedPercent : 0
        });
        StorageService.updateMetrics(m => m.firebaseStorageRequests += 1); // Record upload interaction limit
        syncMetrics();
      };
    };
  };

  // Drag-and-drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processImageFile(files[0]);
    }
  };

  const selectPredefinedImage = (roomName: string) => {
    // Generate a beautiful, minimal default room layout image (or colored block mockup)
    const samples: Record<string, string> = {
      "Obývacia izba": "https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?auto=format&fit=crop&w=800&q=80",
      "Spálňa": "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80",
      "Kuchyňa": "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80",
      "Kúpeľňa": "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80",
    };
    
    setLoading(true);
    const sampleUrl = samples[roomName];
    // Convert to compressed client base64 to ensure identical pipeline
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = sampleUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = 640;
        canvas.height = 425;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, 640, 425);
        ctx.drawImage(img, 0, 0, 640, 425);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        setImageSrc(dataUrl);
        setUploadProgress({
          originalSize: "Externá Šablóna",
          compressedSize: "44.5 KB",
          savedPercent: 82
        });
      }
      setLoading(false);
    };
    img.onerror = () => {
      // Safe abstract sketch block representations in case unsplash network fails
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 425;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#F5F3ED";
        ctx.fillRect(0, 0, 640, 425);
        ctx.strokeStyle = "#1C1C1C";
        ctx.lineWidth = 1;
        ctx.strokeRect(32, 32, 576, 360);
        ctx.font = "italic 11px sans-serif";
        ctx.fillStyle = "#8D8B84";
        ctx.fillText(`Šablóna priestoru: ${roomName} (Architektonický Blok)`, 48, 64);
        setImageSrc(canvas.toDataURL("image/jpeg", 0.7));
        setUploadProgress({
          originalSize: "Vygenerovaná skica",
          compressedSize: "18.2 KB",
          savedPercent: 95
        });
      }
      setLoading(false);
    };
  };

  // Submit redesign processing to full-stack Express controller
  const handleSubmitRedesign = async () => {
    if (!user) {
      setErrorBanner("Ak chcete pokračovať, prihláste sa prosím.");
      return;
    }

    if (profile && profile.credits <= 0) {
      setErrorBanner("Vyčerpali ste svoje bezplatné kredity. Resetujte prosím metriky v simulátore.");
      return;
    }

    setLoading(true);
    setErrorBanner(null);
    setLoadingMessageIndex(0);

    try {
      const payloadImage = imageSrc; // our compressed client-side image (already optimized to ~1024px, JPEG 0.7!)
      
      const response = await fetch("/api/redesign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: payloadImage,
          roomType: roomType,
          style: style,
          budget: budget,
          provider: provider,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          setErrorBanner("Služba je momentálne vyťažená. Váš požiadavok prebehne automaticky o 15 sekúnd.");
          setCountdown(15);
          setRetryTimerActive(true);
          setLoading(false);
          return;
        }
        throw new Error(errData.error || `Chyba servera: Kód ${response.status}`);
      }

      const resJson = await response.json();
      if (resJson.success) {
        const result: RoomAnalysisResult = resJson.data;
        setAnalysisResult(result);
        
        if (resJson.generatedImageUrl) {
          setCustomAfterUrl(resJson.generatedImageUrl);
        } else {
          setCustomAfterUrl(null);
        }
        
        setActiveTab("visual-compare");

        // Complete spark credit simulated reductions
        const updatedCredits = Math.max(0, (profile?.credits || 100) - 1);
        if (profile) {
          const newProfile = { ...profile, credits: updatedCredits };
          setProfile(newProfile);
          await StorageService.saveUserProfile(newProfile);
        }

        // Add to persistent user design boards
        const designId = "design_" + Date.now();
        const colorPaletteJoined = result.colorPalette.join(",");
        const shoppingListJson = JSON.stringify(result.furnitureLayout);

        const newBoard: DesignBoard = {
          id: designId,
          userId: user.uid,
          roomType: roomType,
          style: style,
          budget: budget,
          originalImage: payloadImage || "",
          redesignedImage: "/blueprint/mock",
          colorPalette: colorPaletteJoined,
          analysisText: result.summary,
          shoppingList: shoppingListJson,
          createdAt: new Date().toISOString(),
        };

        await StorageService.saveDesignBoard(newBoard);
        
        // Refresh local design boards history
        const refreshedBoards = await StorageService.loadDesignBoards(user.uid);
        setHistoryBoards(refreshedBoards);

        // Update real-time Sparks / Token metrics
        StorageService.updateMetrics(m => {
          m.geminiRequestsCount += 1;
          m.geminiTokensInput += resJson.simulationMetrics?.geminiTokensInput || 700;
          m.geminiTokensOutput += resJson.simulationMetrics?.geminiTokensOutput || 350;
        });
        syncMetrics();
      }

    } catch (err: any) {
      console.error(err);
      setErrorBanner(err.message || "Komunikácia s umelou inteligenciou zlyhala.");
    } finally {
      if (!retryTimerActive) {
        setLoading(false);
      }
    }
  };

  // Force system to simulate errors as requested by developer constraints
  const triggerSimulationError = (type: "quota429" | "rules403") => {
    if (type === "quota429") {
      setErrorBanner("Služba je momentálne vyťažená. Váš požiadavok prebehne automaticky o 15 sekúnd.");
      setCountdown(15);
      setRetryTimerActive(true);
    } else if (type === "rules403") {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        // Dispatch structured exception mimicking bad Firestore rules lookup matching Error Boundary schema
        const mockErrorJson = {
          error: "Missing or insufficient permissions.",
          operationType: OperationType.WRITE,
          path: `designBoards/BOARD_BAD_PERMISSIONS_SPOOF`,
          authInfo: {
            userId: user?.uid,
            email: user?.email,
            emailVerified: !user?.isAnonymous,
            isAnonymous: user?.isAnonymous,
          }
        };
        throw new Error(JSON.stringify(mockErrorJson));
      }, 500);
    }
  };

  const handleSelectHistoryBoard = (board: DesignBoard) => {
    setImageSrc(board.originalImage);
    setRoomType(board.roomType);
    setStyle(board.style);
    setBudget(board.budget);
    
    // De-serialize results
    setAnalysisResult({
      roomType: board.roomType,
      aestheticStyle: board.style,
      summary: board.analysisText,
      colorPalette: board.colorPalette.split(","),
      materials: ["Svetlosivý dub", "Kompozitný kremeň", "Matná hladená oceľ"], // abstract placeholders
      lightingTips: "Uplatnené hrejivé tóny a vyvážené difúzne osvetlenie priestoru.",
      furnitureLayout: JSON.parse(board.shoppingList),
    });
  };

  const handleDeleteHistoryBoard = async (e: React.MouseEvent, boardId: string) => {
    e.stopPropagation();
    if (user) {
      await StorageService.deleteDesignBoard(user.uid, boardId);
      const boards = await StorageService.loadDesignBoards(user.uid);
      setHistoryBoards(boards);
    }
  };

  const handleExportBlueprint = () => {
    if (!analysisResult) return;

    // Create an in-memory high resolution canvas
    const canvas = document.createElement("canvas");
    const size = 1200;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 1. Draw pure white background (crisp for export & print)
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, size, size);

    // Margin and Layout metrics
    const margin = 100;
    const innerSize = size - 2 * margin;

    // 2. Draw modern technical grid in background
    ctx.strokeStyle = "rgba(28, 28, 28, 0.05)";
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = margin; x <= size - margin; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, margin);
      ctx.lineTo(x, size - margin);
      ctx.stroke();
    }
    for (let y = margin; y <= size - margin; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(size - margin, y);
      ctx.stroke();
    }

    // 3. Draw outer thick architectural room layout boundary
    ctx.strokeStyle = "#1C1C1C";
    ctx.lineWidth = 3;
    ctx.strokeRect(margin, margin, innerSize, innerSize);

    // 4. Draw inner dashed perimeter showing safe spacing bounds
    ctx.strokeStyle = "rgba(28, 28, 28, 0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(margin + 50, margin + 50, innerSize - 100, innerSize - 100);
    ctx.setLineDash([]); // Reset line dash

    // 5. Draw rulers (ticks) along the top and left margins for technical aesthetic
    ctx.fillStyle = "#8D8B84";
    ctx.font = "9px courier, monospace";
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(28, 28, 28, 0.3)";

    // Top horizontal ruler
    for (let x = margin; x <= size - margin; x += 25) {
      const isMajor = (x - margin) % 100 === 0;
      ctx.beginPath();
      ctx.moveTo(x, margin);
      ctx.lineTo(x, margin - (isMajor ? 12 : 6));
      ctx.stroke();
      if (isMajor) {
        ctx.fillText(`${(x - margin) / 2} cm`, x - 12, margin - 16);
      }
    }

    // Left vertical ruler
    for (let y = margin; y <= size - margin; y += 25) {
      const isMajor = (y - margin) % 100 === 0;
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(margin - (isMajor ? 12 : 6), y);
      ctx.stroke();
      if (isMajor) {
        ctx.save();
        ctx.translate(margin - 18, y + 4);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`${(y - margin) / 2} cm`, 0, 0);
        ctx.restore();
      }
    }

    // 6. Draw furniture items as actual technical boxes (using item.width & item.depth)
    analysisResult.furnitureLayout?.forEach((item, idx) => {
      // Coordinate inputs are percentages (e.g. 10 to 85)
      const cx = margin + (Math.max(10, Math.min(85, item.coordinateX)) / 100) * innerSize;
      const cy = margin + (Math.max(10, Math.min(85, item.coordinateY)) / 100) * innerSize;

      // Map width and depth to pixels (scale item width)
      const pxWidth = Math.max(80, Math.min(220, (item.width || 120) * 0.9));
      const pxDepth = Math.max(60, Math.min(180, (item.depth || 80) * 0.9));

      // Draw the rectangle bounding box of the furniture
      ctx.fillStyle = "rgba(250, 249, 246, 0.75)";
      ctx.strokeStyle = "#1C1C1C";
      ctx.lineWidth = 1.5;
      
      ctx.beginPath();
      ctx.rect(cx - pxWidth / 2, cy - pxDepth / 2, pxWidth, pxDepth);
      ctx.fill();
      ctx.stroke();

      // Draw light crossed diagonal line indicating architectural symbol representation
      ctx.strokeStyle = "rgba(28, 28, 28, 0.1)";
      ctx.beginPath();
      ctx.moveTo(cx - pxWidth / 2, cy - pxDepth / 2);
      ctx.lineTo(cx + pxWidth / 2, cy + pxDepth / 2);
      ctx.moveTo(cx + pxWidth / 2, cy - pxDepth / 2);
      ctx.lineTo(cx - pxWidth / 2, cy + pxDepth / 2);
      ctx.stroke();

      // Draw item name inside of the box in miniature
      ctx.fillStyle = "#1C1C1C";
      ctx.font = "italic bold 10px Helvetica, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(item.name.substring(0, 22), cx, cy + pxDepth / 2 - 12);

      // Draw size string inside box
      ctx.fillStyle = "#8D8B84";
      ctx.font = "8px courier, monospace";
      ctx.fillText(`${item.width}x${item.depth} cm`, cx, cy + pxDepth / 2 - 2);

      // Draw solid index dot highlighting position point
      ctx.fillStyle = "#1C1C1C";
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy - 10, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Underwrite index number
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(idx + 1), cx, cy - 10);
      ctx.textBaseline = "alphabetic"; // restore default
    });

    // 7. Draw exquisite Title Block in bottom left
    const blockX = margin + 20;
    const blockY = size - margin - 150;
    const blockW = 340;
    const blockH = 130;

    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#1C1C1C";
    ctx.lineWidth = 2;
    ctx.fillRect(blockX, blockY, blockW, blockH);
    ctx.strokeRect(blockX, blockY, blockW, blockH);

    // Inner lines of title block
    ctx.strokeStyle = "rgba(28, 28, 28, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(blockX, blockY + 36);
    ctx.lineTo(blockX + blockW, blockY + 36);
    ctx.moveTo(blockX, blockY + 95);
    ctx.lineTo(blockX + blockW, blockY + 95);
    ctx.stroke();

    // Title Text fields
    ctx.fillStyle = "#1C1C1C";
    ctx.font = "bold 14px Helvetica, Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("AI REDIZAJN INTERIÉRU", blockX + 12, blockY + 24);

    ctx.fillStyle = "#8D8B84";
    ctx.font = "9px courier, monospace";
    ctx.fillText("SWISS ARCHITECTURE CORE V2.5", blockX + 175, blockY + 24);

    // Meta details (Room structure, aesthetic theme, budgets etc.)
    ctx.fillStyle = "#1C1C1C";
    ctx.font = "bold 10px Helvetica, Arial, sans-serif";
    ctx.fillText(`MIESTNOSŤ:  ${roomType.toUpperCase()}`, blockX + 12, blockY + 54);
    ctx.fillText(`ESTETIKA:   ${style.toUpperCase()}`, blockX + 12, blockY + 69);
    ctx.fillText(`ROZPOČET:   ${budget} EUR`, blockX + 12, blockY + 84);

    ctx.fillStyle = "#8D8B84";
    ctx.font = "9px courier, monospace";
    ctx.fillText("MIERKA: 1:50  |  SEVER: ↑", blockX + 12, blockY + 112);
    ctx.fillText(`DÁTUM: ${new Date().toLocaleDateString("sk-SK")}`, blockX + 175, blockY + 112);

    // 8. Draw compact dynamic Color Palette in the corner of physical Canvas
    const palX = size - margin - 220;
    const palY = size - margin - 45;
    
    // Title of palette
    ctx.fillStyle = "#8D8B84";
    ctx.font = "bold 9px courier, monospace";
    ctx.fillText("DOPORUČENÁ PALETA FARIEB", palX, palY - 8);

    analysisResult.colorPalette?.forEach((color, cIdx) => {
      const px = palX + cIdx * 35;
      
      // Box
      ctx.fillStyle = color;
      ctx.strokeStyle = "rgba(28, 28, 28, 0.2)";
      ctx.lineWidth = 1;
      ctx.fillRect(px, palY, 30, 20);
      ctx.strokeRect(px, palY, 30, 20);

      // Hex code annotation
      ctx.fillStyle = "rgba(28, 28, 28, 0.6)";
      ctx.font = "7px courier, monospace";
      ctx.fillText(color.toUpperCase(), px, palY + 30);
    });

    // 8.5 Draw beautiful modern Materials Specification Box above the color palette on the right side
    const matW = 220;
    const matH = 135;
    const matX = size - margin - matW;
    const matY = palY - 30 - matH;

    // Draw background block
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#1C1C1C";
    ctx.lineWidth = 1.5;
    ctx.fillRect(matX, matY, matW, matH);
    ctx.strokeRect(matX, matY, matW, matH);

    // Title line & text
    ctx.strokeStyle = "rgba(28, 28, 28, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(matX, matY + 30);
    ctx.lineTo(matX + matW, matY + 30);
    ctx.stroke();

    ctx.fillStyle = "#1C1C1C";
    ctx.font = "bold 9px courier, monospace";
    ctx.textAlign = "left";
    ctx.fillText("MATERIÁLOVÁ ŠPECIFIKÁCIA", matX + 10, matY + 18);

    // List of materials
    const materialsList = analysisResult.materials || [];
    if (materialsList.length === 0) {
      ctx.fillStyle = "#8D8B84";
      ctx.font = "italic 9px Helvetica, Arial, sans-serif";
      ctx.fillText("Dubové drevo, brúsená oceľ", matX + 10, matY + 50);
      ctx.fillText("Prírodný kameň, matné sklo", matX + 10, matY + 68);
    } else {
      materialsList.slice(0, 5).forEach((material, idx) => {
        const itemY = matY + 48 + idx * 16;
        
        // Draw tiny custom bullet square
        ctx.fillStyle = "#121212";
        ctx.fillRect(matX + 10, itemY - 6, 4, 4);

        // Draw material text
        ctx.fillStyle = "rgba(28, 28, 28, 0.85)";
        ctx.font = "9px Helvetica, Arial, sans-serif";
        // Truncate material name if it's too long
        const truncatedMaterial = material.length > 32 ? material.substring(0, 30) + "..." : material;
        ctx.fillText(truncatedMaterial, matX + 20, itemY - 2);
      });
    }

    // 9. Fire save browser flow!
    try {
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      const link = document.createElement("a");
      link.download = `swiss_redizajn_podorys_${roomType.toLowerCase().replace(/\s+/g, "_")}.jpg`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Log interaction in metrics
      StorageService.updateMetrics(m => m.firebaseStorageRequests += 1);
      syncMetrics();
    } catch (e) {
      console.error("Zlyhal export pôdorysu ako JPEG", e);
    }
  };

  const handleExportStackedComparison = async () => {
    setIsExportingComparison(true);
    setErrorBanner(null);

    const beforeUrl = imageSrc || "https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?auto=format&fit=crop&w=1200&q=80";
    const afterUrl = customAfterUrl || (AFTER_IMAGES_MAPPING[roomType]?.[style] || "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80");

    const loadImg = (url: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
      });
    };

    try {
      // 1. Load both images in parallel
      const [beforeImg, afterImg] = await Promise.all([
        loadImg(beforeUrl),
        loadImg(afterUrl),
      ]);

      // 2. Set up high definition canvas dims
      const canvas = document.createElement("canvas");
      const width = 1200;
      const originalRatio = 9 / 16; // 16:9
      const imgHeight = Math.round(width * originalRatio); // 675px

      // Dims: Header title (110px) + TitleBefore (50px) + beforeImg (675px) + TitleAfter (50px) + afterImg (675px) + Footer details (60px) = 1620px
      const headerHeight = 110;
      const subtitleHeight = 50;
      const footerHeight = 60;
      const totalHeight = headerHeight + subtitleHeight * 2 + imgHeight * 2 + footerHeight;

      canvas.width = width;
      canvas.height = totalHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Nepodarilo sa vytvoriť 2D kontext.");

      // Fill pure elegant premium beige/white back
      ctx.fillStyle = "#FAF9F6";
      ctx.fillRect(0, 0, width, totalHeight);

      // --- 1. MAIN HEADER ---
      // Draw solid Swiss slate/charcoal header banner for pristine visual branding
      ctx.fillStyle = "#1C1C1C";
      ctx.fillRect(0, 0, width, headerHeight);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 24px Helvetica, Arial, sans-serif";
      ctx.fillText("SWISS ARCHITECTURAL RESPATIAL REDESIGN", 40, 50);

      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.font = "12px monospace";
      ctx.fillText(`MIESTNOSŤ: ${roomType.toUpperCase()} | ARCHITEKTONICKÝ ŠTÝL: ${style.toUpperCase()}`, 40, 80);

      ctx.fillStyle = "#D97706"; // Amber accent color
      ctx.font = "bold 12px monospace";
      ctx.fillText("AI ANALÝZA & DISPOZÍCIA SPATIAL BLUEPRINT v2.5", width - 360, 50);

      // --- 2. BEFORE SECTION ---
      let currentY = headerHeight;
      
      // Background row for label
      ctx.fillStyle = "#FAF8F5";
      ctx.fillRect(0, currentY, width, subtitleHeight);
      
      ctx.fillStyle = "#1C1C1C";
      ctx.font = "bold 14px Helvetica, Arial, sans-serif";
      ctx.fillText("PRED (PÔVODNÝ STAV MIESTNOSTI)", 40, currentY + 30);

      ctx.fillStyle = "#8D8B84";
      ctx.font = "11px monospace";
      ctx.fillText("• Neusporiadaný alebo prázdny stavebný pôdorys", width - 380, currentY + 30);

      // Draw thin elegant border line
      ctx.strokeStyle = "rgba(28, 28, 28, 0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, currentY + subtitleHeight);
      ctx.lineTo(width, currentY + subtitleHeight);
      ctx.stroke();

      currentY += subtitleHeight;

      // Draw the Before image
      ctx.drawImage(beforeImg, 0, currentY, width, imgHeight);

      currentY += imgHeight;

      // --- 3. AFTER SECTION ---
      // Background row for label
      ctx.fillStyle = "#FAF8F5";
      ctx.fillRect(0, currentY, width, subtitleHeight);

      ctx.fillStyle = "#1C1C1C";
      ctx.font = "bold 14px Helvetica, Arial, sans-serif";
      ctx.fillText(`PO (SPATIAL REDIZAJN - ŠTÝL ${style.toUpperCase()})`, 40, currentY + 30);

      ctx.fillStyle = "#10B981"; // Green success text
      ctx.font = "bold 11px monospace";
      ctx.fillText("✔ Fotorealistická optimalizácia & Swiss Minimalistický dizajn", width - 420, currentY + 30);

      // Draw thin elegant border line
      ctx.beginPath();
      ctx.moveTo(0, currentY + subtitleHeight);
      ctx.lineTo(width, currentY + subtitleHeight);
      ctx.stroke();

      currentY += subtitleHeight;

      // Draw the After image
      ctx.drawImage(afterImg, 0, currentY, width, imgHeight);

      currentY += imgHeight;

      // --- 4. FOOTER ---
      ctx.fillStyle = "#F5F3ED";
      ctx.fillRect(0, currentY, width, footerHeight);

      // Fine elegant separator
      ctx.beginPath();
      ctx.moveTo(0, currentY);
      ctx.lineTo(width, currentY);
      ctx.stroke();

      ctx.fillStyle = "#55524B";
      ctx.font = "11px monospace";
      ctx.fillText("Navrhnuté automatizovaným CAD-AI systémom | Všetky Práva Vyhradené", 40, currentY + 35);

      const timestamp = new Date().toLocaleString("sk-SK");
      ctx.fillText(`Dátum vyhotovenia: ${timestamp}`, width - 280, currentY + 35);

      // --- 5. TRIGGER BROWSER DOWNLOAD ---
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      const link = document.createElement("a");
      link.download = `swiss-redizajn-porovnanie-pred-po.jpg`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Update stats and metrics
      StorageService.updateMetrics(m => m.firebaseStorageRequests += 1);
      syncMetrics();

    } catch (err) {
      console.error("Chyba exportu porovnania obrázkov", err);
      setErrorBanner("Obrázky sa nepodarilo spojiť a uložiť. Dôvodom môžu byť CORS obmedzenia vášho prehliadača. Skúste si obrázky stiahnuť samostatne.");
    } finally {
      setIsExportingComparison(false);
    }
  };

  const drawWrappedText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    startX: number,
    startY: number,
    maxWidth: number,
    lineHeight: number,
    fontStyle: string,
    fillStyle: string
  ): number => {
    ctx.font = fontStyle;
    ctx.fillStyle = fillStyle;
    const paragraphs = text.split("\n");
    let currentY = startY;
    
    for (const paragraph of paragraphs) {
      if (paragraph.trim() === "") {
        currentY += lineHeight * 0.4;
        continue;
      }
      const words = paragraph.split(" ");
      let line = "";
      
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + " ";
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        
        if (testWidth > maxWidth && n > 0) {
          ctx.fillText(line.trim(), startX, currentY);
          line = words[n] + " ";
          currentY += lineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line.trim(), startX, currentY);
      currentY += lineHeight;
    }
    return currentY;
  };

  const handleExportPDFReport = async () => {
    if (!analysisResult) return;
    setIsExportingPDF(true);
    setErrorBanner(null);

    try {
      // 1. Init PDF document in A4 proportions
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4"
      });

      // Canvas dimensions for sharp 300dpi scaling (1200 x 1697 inside A4)
      const canvasW = 1200;
      const canvasH = 1697;

      // ==========================================
      // PAGE 1: ARCHITECTURAL DESIGN STUDY
      // ==========================================
      const page1 = document.createElement("canvas");
      page1.width = canvasW;
      page1.height = canvasH;
      const ctx1 = page1.getContext("2d");
      if (!ctx1) throw new Error("Nepodarilo sa vytvoriť 2D kontext.");

      // Elegant off-white cream background
      ctx1.fillStyle = "#FAF9F6";
      ctx1.fillRect(0, 0, canvasW, canvasH);

      // --- BRAND HEADER ---
      ctx1.fillStyle = "#1C1C1C";
      ctx1.fillRect(0, 0, canvasW, 130);

      ctx1.fillStyle = "#FFFFFF";
      ctx1.font = "bold 23px Helvetica, Arial, sans-serif";
      ctx1.textAlign = "left";
      ctx1.fillText("SWISS INTERIÉROVÝ ARCHITEKTONICKÝ REPORT", 60, 52);

      ctx1.fillStyle = "rgba(255, 255, 255, 0.65)";
      ctx1.font = "11px monospace";
      ctx1.fillText(`CAD-AI BLUEPRINT REPORT  |  POTENCIÁLNY NÁKUPNÝ PLÁN   |  PROJEKT: #${profile?.userId?.substring(0, 10) || "SWISS-PROJ"}`, 60, 80);

      ctx1.fillStyle = "#D97706";
      ctx1.font = "bold 13px monospace";
      ctx1.textAlign = "right";
      ctx1.fillText("PREMIUM ŠTÚDIA v2.5", canvasW - 60, 52);

      const today = new Date().toLocaleDateString("sk-SK");
      ctx1.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx1.font = "10px monospace";
      ctx1.fillText(`Dátum vygenerovania: ${today}`, canvasW - 60, 80);

      // --- LEFT COLUMN: 2D Blueprint Schematic ---
      const bx = 60;
      const by = 180;
      const bw = 480;
      const bh = 480;

      // Card Background for drawing
      ctx1.fillStyle = "#FFFFFF";
      ctx1.strokeStyle = "rgba(28, 28, 28, 0.15)";
      ctx1.lineWidth = 1;
      ctx1.fillRect(bx, by, bw, bh);
      ctx1.strokeRect(bx, by, bw, bh);

      // Draw grid behind the layout
      ctx1.strokeStyle = "rgba(28, 28, 28, 0.04)";
      ctx1.lineWidth = 1;
      const innerGrid = bh / 10;
      for (let x = bx; x <= bx + bw; x += innerGrid) {
        ctx1.beginPath(); ctx1.moveTo(x, by); ctx1.lineTo(x, by + bh); ctx1.stroke();
      }
      for (let y = by; y <= by + bh; y += innerGrid) {
        ctx1.beginPath(); ctx1.moveTo(bx, y); ctx1.lineTo(bx + bw, y); ctx1.stroke();
      }

      // Safe blueprint boundary stroke
      ctx1.strokeStyle = "#1C1C1C";
      ctx1.lineWidth = 2.5;
      ctx1.strokeRect(bx + 15, by + 15, bw - 30, bh - 30);

      // Draw actual schematic furniture items
      analysisResult.furnitureLayout?.forEach((item, idx) => {
        const cx = bx + 15 + (Math.max(10, Math.min(85, item.coordinateX)) / 100) * (bw - 30);
        const cy = by + 15 + (Math.max(10, Math.min(85, item.coordinateY)) / 100) * (bh - 30);

        const pxWidth = Math.max(35, Math.min(100, (item.width || 120) * 0.4));
        const pxDepth = Math.max(30, Math.min(85, (item.depth || 80) * 0.4));

        ctx1.fillStyle = "rgba(250, 249, 246, 0.85)";
        ctx1.strokeStyle = "#1C1C1C";
        ctx1.lineWidth = 1.2;
        ctx1.beginPath();
        ctx1.rect(cx - pxWidth / 2, cy - pxDepth / 2, pxWidth, pxDepth);
        ctx1.fill();
        ctx1.stroke();

        ctx1.strokeStyle = "rgba(28, 28, 28, 0.08)";
        ctx1.beginPath();
        ctx1.moveTo(cx - pxWidth / 2, cy - pxDepth / 2); ctx1.lineTo(cx + pxWidth / 2, cy + pxDepth / 2);
        ctx1.moveTo(cx + pxWidth / 2, cy - pxDepth / 2); ctx1.lineTo(cx - pxWidth / 2, cy + pxDepth / 2);
        ctx1.stroke();

        ctx1.fillStyle = "#1C1C1C";
        ctx1.font = "bold 9px Helvetica, sans-serif";
        ctx1.textAlign = "center";
        ctx1.fillText(item.name.substring(0, 16), cx, cy + pxDepth / 2 - 10);

        ctx1.fillStyle = "#8D8B84";
        ctx1.font = "7px courier, monospace";
        ctx1.fillText(`${item.width}x${item.depth} cm`, cx, cy + pxDepth / 2 - 2);

        ctx1.fillStyle = "#1C1C1C";
        ctx1.strokeStyle = "#FFFFFF";
        ctx1.lineWidth = 1.5;
        ctx1.beginPath();
        ctx1.arc(cx, cy - 8, 10, 0, Math.PI * 2);
        ctx1.fill();
        ctx1.stroke();

        ctx1.fillStyle = "#FFFFFF";
        ctx1.font = "bold 9px Helvetica, sans-serif";
        ctx1.textAlign = "center";
        ctx1.textBaseline = "middle";
        ctx1.fillText(String(idx + 1), cx, cy - 8);
        ctx1.textBaseline = "alphabetic";
      });

      ctx1.fillStyle = "#8D8B84";
      ctx1.font = "bold 8px monospace";
      ctx1.textAlign = "right";
      ctx1.fillText("MIERKA 1:50  |  SEVER: ↑ [STRIKTNÝ PLÁN]", bx + bw - 15, by + bh - 10);

      // --- RIGHT COLUMN: Room metadata & Color Palette info ---
      const rx = 580;
      const ry = 180;
      const rw = 560;

      ctx1.fillStyle = "#FFFFFF";
      ctx1.strokeStyle = "rgba(28, 28, 28, 0.1)";
      ctx1.lineWidth = 1;
      ctx1.fillRect(rx, ry, rw, 480);
      ctx1.strokeRect(rx, ry, rw, 480);

      ctx1.fillStyle = "#1C1C1C";
      ctx1.font = "bold 13px monospace";
      ctx1.textAlign = "left";
      ctx1.fillText("ZÁKLADNÉ ARCHITEKTONICKÉ METADÁTA", rx + 25, ry + 40);

      ctx1.font = "11px Helvetica, sans-serif";
      ctx1.fillStyle = "#444444";
      ctx1.fillText("Typ dotknutej miestnosti:", rx + 25, ry + 75);
      ctx1.font = "bold 11px Helvetica, sans-serif";
      ctx1.fillStyle = "#1C1C1C";
      ctx1.fillText(roomType.toUpperCase(), rx + 225, ry + 75);

      ctx1.font = "11px Helvetica, sans-serif";
      ctx1.fillStyle = "#444444";
      ctx1.fillText("Estetika a dizajnový smer:", rx + 25, ry + 100);
      ctx1.font = "bold 11px Helvetica, sans-serif";
      ctx1.fillStyle = "#1C1C1C";
      ctx1.fillText(style.toUpperCase(), rx + 225, ry + 100);

      ctx1.font = "11px Helvetica, sans-serif";
      ctx1.fillStyle = "#444444";
      ctx1.fillText("Zvolený finančný plán / limit:", rx + 25, ry + 125);
      ctx1.font = "bold 11px Helvetica, sans-serif";
      ctx1.fillStyle = "#1C1C1C";
      ctx1.fillText(`${budget} EUR`, rx + 225, ry + 125);

      ctx1.font = "bold 12px monospace";
      ctx1.fillText("ODPORÚČANÁ 10/30/60 FAREBNÁ PALETA (SWISS TÓN)", rx + 25, ry + 180);

      analysisResult.colorPalette?.forEach((color, cIdx) => {
        const offset = ry + 215 + cIdx * 56;
        ctx1.fillStyle = color;
        ctx1.strokeStyle = "rgba(0, 0, 0, 0.15)";
        ctx1.lineWidth = 1;
        ctx1.fillRect(rx + 25, offset, 50, 32);
        ctx1.strokeRect(rx + 25, offset, 50, 32);

        ctx1.fillStyle = "#1C1C1C";
        ctx1.font = "bold 11px monospace";
        ctx1.fillText(color, rx + 95, offset + 15);

        ctx1.fillStyle = "#666666";
        ctx1.font = "9px Helvetica, sans-serif";
        let usageLabel = "Akcentačný minimalistický tón (10%)";
        if (cIdx === 0) usageLabel = "Dominantný tón stien a podlahy (60%)";
        if (cIdx === 1) usageLabel = "Sekundárny tón nábytkových zostáv (30%)";
        ctx1.fillText(usageLabel, rx + 95, offset + 29);
      });

      // --- BOTTOM FULL CONTENT: Critique prose ---
      const criticY = 690;
      ctx1.fillStyle = "#FFFFFF";
      ctx1.strokeStyle = "rgba(28, 28, 28, 0.12)";
      ctx1.lineWidth = 1;
      ctx1.fillRect(60, criticY, canvasW - 120, 410);
      ctx1.strokeRect(60, criticY, canvasW - 120, 410);

      ctx1.fillStyle = "#1C1C1C";
      ctx1.fillRect(60, criticY, canvasW - 120, 40);

      ctx1.fillStyle = "#FFFFFF";
      ctx1.font = "bold 12px monospace";
      ctx1.fillText("KRITICKÉ DIZAJNOVÉ ZHODNOTENIE PRIESTORU", 85, criticY + 25);

      const critiqueText = analysisResult.summary || "Architektonické posúdenie priestoru prebehlo úspešne.";
      drawWrappedText(
        ctx1,
        critiqueText,
        85,
        criticY + 80,
        canvasW - 170,
        21,
        "11.5px Helvetica, Arial, sans-serif",
        "#333333"
      );

      // --- MATERIALS & LIGHTING COLUMNS ---
      const colY = 1130;
      const colW = 515;
      const colH = 430;

      // Materials card
      ctx1.fillStyle = "#FFFFFF";
      ctx1.strokeStyle = "rgba(28, 28, 28, 0.1)";
      ctx1.fillRect(60, colY, colW, colH);
      ctx1.strokeRect(60, colY, colW, colH);

      ctx1.fillStyle = "#1C1C1C";
      ctx1.fillRect(60, colY, colW, 35);
      ctx1.fillStyle = "#FFFFFF";
      ctx1.font = "bold 11px monospace";
      ctx1.fillText("ODPORÚČANÉ MATERIÁLY (TEXTÚRY)", 80, colY + 22);

      analysisResult.materials?.forEach((mat, mIdx) => {
        const rowY = colY + 70 + mIdx * 34;
        ctx1.fillStyle = "#1C1C1C";
        ctx1.fillRect(80, rowY - 6, 6, 6);

        ctx1.fillStyle = "#1C1C1C";
        ctx1.font = "bold 11px Helvetica, sans-serif";
        ctx1.fillText(mat, 96, rowY);
      });

      ctx1.fillStyle = "#666666";
      ctx1.font = "italic 10px Helvetica, sans-serif";
      drawWrappedText(ctx1, "Materiály boli prísne vyberané tak, aby spolu ladili na báze moderného švajčiarskeho kontrastu teplých a studených zemitých zložiek.", 80, colY + 220, colW - 40, 16, "italic 10px Helvetica, sans-serif", "#666666");

      // Lighting card
      const lx = 625;
      ctx1.fillStyle = "#FFFFFF";
      ctx1.strokeStyle = "rgba(28, 28, 28, 0.1)";
      ctx1.fillRect(lx, colY, colW, colH);
      ctx1.strokeRect(lx, colY, colW, colH);

      ctx1.fillStyle = "#1C1C1C";
      ctx1.fillRect(lx, colY, colW, 35);
      ctx1.fillStyle = "#FFFFFF";
      ctx1.font = "bold 11px monospace";
      ctx1.fillText("ODPORÚČANIA PRE ROZVRSTVENIE SVETLA", lx + 20, colY + 22);

      const tipsText = analysisResult.lightingTips || "Svetelný plán pre správnu ambientnú atmosféru.";
      drawWrappedText(
        ctx1,
        tipsText,
        lx + 20,
        colY + 70,
        colW - 40,
        20,
        "11px Helvetica, Arial, sans-serif",
        "#444444"
      );

      // Page 1 Footer border
      ctx1.strokeStyle = "rgba(28, 28, 28, 0.08)";
      ctx1.lineWidth = 1;
      ctx1.beginPath();
      ctx1.moveTo(60, canvasH - 65);
      ctx1.lineTo(canvasW - 60, canvasH - 65);
      ctx1.stroke();

      ctx1.fillStyle = "#8D8B84";
      ctx1.font = "9px monospace";
      ctx1.textAlign = "left";
      ctx1.fillText(`Projektová zložka: ${profile?.email || "Vážený zákazník"}  |  Swiss CAD-AI v2.5`, 60, canvasH - 45);

      ctx1.textAlign = "right";
      ctx1.fillText("Strana 1 z 2  (Architektonická Štúdia)", canvasW - 60, canvasH - 45);


      // ==========================================
      // PAGE 2: DETAILED SHOPPING LIST & DISCIPLINE
      // ==========================================
      const page2 = document.createElement("canvas");
      page2.width = canvasW;
      page2.height = canvasH;
      const ctx2 = page2.getContext("2d");
      if (!ctx2) throw new Error("Nepodarilo sa vytvoriť 2D kontext.");

      ctx2.fillStyle = "#FAF9F6";
      ctx2.fillRect(0, 0, canvasW, canvasH);

      // --- BRAND HEADER ---
      ctx2.fillStyle = "#1C1C1C";
      ctx2.fillRect(0, 0, canvasW, 130);

      ctx2.fillStyle = "#FFFFFF";
      ctx2.font = "bold 23px Helvetica, Arial, sans-serif";
      ctx2.textAlign = "left";
      ctx2.fillText("NÁKUPNÝ ZOZNAM & FINANČNÝ ROZPOČET", 60, 52);

      ctx2.fillStyle = "rgba(255, 255, 255, 0.65)";
      ctx2.font = "11px monospace";
      ctx2.fillText("ODPORÚČANÝ SÚPIS NÁBYTKU PRE SLOVENSKÚ DISTRIBUČNÚ SIEŤ", 60, 80);

      ctx2.fillStyle = "#D97706";
      ctx2.font = "bold 13px monospace";
      ctx2.textAlign = "right";
      ctx2.fillText("INVESTIČNÝ KONSOLIDOVANÝ PLÁN", canvasW - 60, 52);

      ctx2.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx2.font = "10px monospace";
      ctx2.fillText(`Miestnosť: ${roomType} | Štýl: ${style}`, canvasW - 60, 80);

      // --- SHOPPING LIST TABLE ---
      ctx2.textAlign = "left";
      const tableY = 170;
      const columnSpacing = {
        idx: 60,
        name: 120,
        cat: 510,
        dims: 670,
        store: 810,
        price: 980
      };

      // Table dark header row
      ctx2.fillStyle = "#2D2D2D";
      ctx2.fillRect(60, tableY, canvasW - 120, 36);

      ctx2.fillStyle = "#FFFFFF";
      ctx2.font = "bold 10px monospace";
      ctx2.fillText("#", columnSpacing.idx + 10, tableY + 22);
      ctx2.fillText("NÁZOV PRVKU A POPIS", columnSpacing.name, tableY + 22);
      ctx2.fillText("KATEGÓRIA", columnSpacing.cat, tableY + 22);
      ctx2.fillText("ROZMERY", columnSpacing.dims, tableY + 22);
      ctx2.fillText("DISTRIBÚTOR v SR", columnSpacing.store, tableY + 22);
      ctx2.fillText("ODHAD. CENA", columnSpacing.price, tableY + 22);

      let currentTableRowY = tableY + 36;
      let totalCost = 0;

      // Draw table items dynamically
      analysisResult.furnitureLayout?.forEach((item, idx) => {
        totalCost += item.estimatedPrice;

        // Striped rows background
        ctx2.fillStyle = idx % 2 === 0 ? "#FFFFFF" : "#F5F4EE";
        ctx2.fillRect(60, currentTableRowY, canvasW - 120, 68);

        // Thin separating border line below the row
        ctx2.strokeStyle = "rgba(28, 28, 28, 0.08)";
        ctx2.lineWidth = 1;
        ctx2.beginPath();
        ctx2.moveTo(60, currentTableRowY + 68);
        ctx2.lineTo(canvasW - 60, currentTableRowY + 68);
        ctx2.stroke();

        // Index
        ctx2.fillStyle = "#1C1C1C";
        ctx2.font = "bold 13px Helvetica, sans-serif";
        ctx2.fillText(String(idx + 1), columnSpacing.idx + 10, currentTableRowY + 30);

        // Name
        ctx2.fillStyle = "#1C1C1C";
        ctx2.font = "bold 11px Helvetica, Arial, sans-serif";
        ctx2.fillText(item.name, columnSpacing.name, currentTableRowY + 25);

        // Short description below name
        ctx2.fillStyle = "#666666";
        ctx2.font = "9px Helvetica, sans-serif";
        const shortDesc = item.description && item.description.length > 70 
          ? item.description.substring(0, 67) + "..." 
          : item.description || "Swiss minimalistický nábytkový doplnok.";
        ctx2.fillText(shortDesc, columnSpacing.name, currentTableRowY + 44);

        // Category
        ctx2.fillStyle = "#444444";
        ctx2.font = "10px Helvetica, sans-serif";
        ctx2.fillText(item.category, columnSpacing.cat, currentTableRowY + 30);

        // Dims
        ctx2.fillStyle = "#1C1C1C";
        ctx2.font = "10px monospace";
        ctx2.fillText(`${item.width} x ${item.depth} cm`, columnSpacing.dims, currentTableRowY + 30);

        // Store
        ctx2.fillStyle = "#444444";
        ctx2.font = "10px Helvetica, sans-serif";
        ctx2.fillText(item.storeRecommendation, columnSpacing.store, currentTableRowY + 30);

        // Price
        ctx2.fillStyle = "#1C1C1C";
        ctx2.font = "bold 11px monospace";
        ctx2.fillText(`${item.estimatedPrice} EUR`, columnSpacing.price, currentTableRowY + 30);

        currentTableRowY += 68;
      });

      // --- BUDGET SUMMARY SECTION ---
      let budgetY = currentTableRowY + 40;
      if (budgetY > canvasH - 510) {
        budgetY = canvasH - 480;
      }

      ctx2.fillStyle = "#FFFFFF";
      ctx2.strokeStyle = "rgba(28, 28, 28, 0.15)";
      ctx2.lineWidth = 1.5;
      ctx2.fillRect(60, budgetY, canvasW - 120, 240);
      ctx2.strokeRect(60, budgetY, canvasW - 120, 240);

      // Section header inside card
      ctx2.fillStyle = "#1C1C1C";
      ctx2.fillRect(60, budgetY, canvasW - 120, 40);

      ctx2.fillStyle = "#FFFFFF";
      ctx2.font = "bold 12px monospace";
      ctx2.fillText("FINANČNÉ KONSOLIDOVANÉ VYHODNOTENIE ROZPOČTOVEJ DISCIPLÍNY", 85, budgetY + 25);

      // Calculations columns
      const calcX1 = 100;
      const calcX2 = 620;

      ctx2.fillStyle = "#444444";
      ctx2.font = "12px Helvetica, sans-serif";
      ctx2.fillText("Vyčíslené projektové náklady (Suma položiek):", calcX1, budgetY + 85);
      ctx2.fillStyle = "#1C1C1C";
      ctx2.font = "bold 14px monospace";
      ctx2.fillText(`${totalCost} EUR`, calcX1 + 380, budgetY + 85);

      ctx2.fillStyle = "#444444";
      ctx2.font = "12px Helvetica, sans-serif";
      ctx2.fillText("Finančný limit (Váš naplánovaný strop):", calcX1, budgetY + 125);
      ctx2.fillStyle = "#1C1C1C";
      ctx2.font = "bold 14px monospace";
      ctx2.fillText(`${budget} EUR`, calcX1 + 380, budgetY + 125);

      // Accent balance block
      const isOverBudget = totalCost > budget;
      const balance = budget - totalCost;

      ctx2.fillStyle = isOverBudget ? "#FEE2E2" : "#D1FAE5";
      ctx2.fillRect(calcX2, budgetY + 65, 420, 100);

      ctx2.strokeStyle = isOverBudget ? "#EF4444" : "#10B981";
      ctx2.lineWidth = 1;
      ctx2.strokeRect(calcX2, budgetY + 65, 420, 100);

      ctx2.fillStyle = isOverBudget ? "#991B1B" : "#065F46";
      ctx2.font = "bold 11px monospace";
      ctx2.fillText(isOverBudget ? "⚠️ UPOZORNENRE: ROZPOČET PREKROČENÝ" : "✔ STAV ZOSTÁVAJÚCEJ FINANČNEJ REZERVY", calcX2 + 20, budgetY + 95);

      ctx2.font = "bold 18px Helvetica, Arial, sans-serif";
      ctx2.fillText(`${balance >= 0 ? "+" : ""}${balance} EUR`, calcX2 + 20, budgetY + 135);

      ctx2.fillStyle = "#55524B";
      ctx2.font = "italic 10.5px Helvetica, Arial, sans-serif";
      const advice = isOverBudget 
        ? "Odporúčame dbať na prísnejšiu materiálovú redukciu prípadne alternatívneho slovenského distribútora na zníženie celkového finančného profilu."
        : "Finančný plán spĺňa striktné kritériá švajčiarskej úspornosti a zachováva vyváženú rezervu na nepredvídané náklady počas montáže.";
      drawWrappedText(ctx2, advice, 100, budgetY + 185, canvasW - 200, 16, "italic 10.5px Helvetica, Arial, sans-serif", "#55524B");

      // Page 2 Footer border
      ctx2.strokeStyle = "rgba(28, 28, 28, 0.08)";
      ctx2.lineWidth = 1;
      ctx2.beginPath();
      ctx2.moveTo(60, canvasH - 65);
      ctx2.lineTo(canvasW - 60, canvasH - 65);
      ctx2.stroke();

      ctx2.fillStyle = "#8D8B84";
      ctx2.font = "9px monospace";
      ctx2.textAlign = "left";
      ctx2.fillText("Vypracované švajčiarskym algoritmom CAD-AI v spolupráci s dizajnérom.", 60, canvasH - 45);

      ctx2.textAlign = "right";
      ctx2.fillText("Strana 2 z 2  (Nákupný Plán & Rozpočet)", canvasW - 60, canvasH - 45);

      // ==========================================
      // STITCHING THEM INTO PDF & SAVING
      // ==========================================
      const addCanvasToPDF = (canvasObj: HTMLCanvasElement, pageIdx: number) => {
        const imgData = canvasObj.toDataURL("image/jpeg", 0.94);
        if (pageIdx > 0) {
          doc.addPage();
        }
        doc.addImage(imgData, "JPEG", 0, 0, 595.28, 841.89, `pdf_page_${pageIdx}`, "MEDIUM");
      };

      addCanvasToPDF(page1, 0);
      addCanvasToPDF(page2, 1);

      // Save PDF
      doc.save(`swiss-architektonicky-report-${roomType.toLowerCase().replace(/\s+/g, "_")}.pdf`);

      // Increment metrics tracker
      StorageService.updateMetrics(m => m.firebaseStorageRequests += 1);
      syncMetrics();

    } catch (err: any) {
      console.error("Export do PDF zlyhal.", err);
      setErrorBanner("Chyba exportu PDF: " + (err?.message || String(err)));
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleResetMetrics = () => {
    StorageService.resetMetrics();
    syncMetrics();
    if (profile) {
      const resetProf = { ...profile, credits: 150 };
      setProfile(resetProf);
      StorageService.saveUserProfile(resetProf);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] swiss-grid flex flex-col text-gray-900 font-sans selection:bg-[#1C1C1C] selection:text-white">
      
      {/* 429 RESPONSIVE RETRY BANNER */}
      <AnimatePresence>
        {errorBanner && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-[#1C1C1C] text-white py-3 px-6 text-xs font-mono flex items-center justify-between border-b border-black select-none"
          >
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{errorBanner}</span>
              {retryTimerActive && (
                <span className="font-bold underline text-amber-300 ml-1">
                  Opakovaný pokus o {countdown} sekúnd...
                </span>
              )}
            </div>
            <div className="flex items-center space-x-3">
              {retryTimerActive && (
                <button 
                  onClick={() => {
                    setRetryTimerActive(false);
                    setErrorBanner(null);
                  }}
                  className="bg-white/10 hover:bg-white/20 px-2 py-0.5 uppercase cursor-pointer"
                >
                  Zrušiť
                </button>
              )}
              <button 
                onClick={() => setErrorBanner(null)} 
                className="text-white hover:text-white/60 font-bold p-1 shrink-0"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER SECTION */}
      <header className="bg-white border-b border-[#1C1C1C]/10 py-3 md:py-4 px-4 md:px-12 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-4">
          
          {/* Logo Brand with quilted thin-line frame */}
          <div className="flex items-center space-x-3 self-start lg:self-auto w-full lg:w-auto justify-between lg:justify-start">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-[#1C1C1C] text-[#FAF9F6] flex items-center justify-center font-display font-semibold text-lg select-none shrink-0">
                S
              </div>
              <div>
                <h1 className="font-display font-bold text-sm md:text-base tracking-tight text-gray-900 leading-none">
                  AI REDIZAJN INTERIÉRU
                </h1>
                <span className="text-[9px] md:text-[10px] font-mono tracking-wider text-gray-400 uppercase block mt-1">
                  Swiss Architecture Core v2.5
                </span>
              </div>
            </div>
          </div>

          {/* Credentials status bar */}
          <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs w-full lg:w-auto justify-start lg:justify-center">
            <div className="flex items-center space-x-1.5 bg-[#1C1C1C]/5 px-2.5 py-1.5 rounded-none border border-[#1C1C1C]/10 text-[11px] md:text-xs">
              <Database className="w-3.5 h-3.5 text-gray-600 shrink-0" />
              <span className="font-mono text-gray-500 truncate max-w-[170px] sm:max-w-none">
                DB: {isFirebaseConfigured ? "Spark Cloud DB Active" : "LocalStorage Mode (Guest)"}
              </span>
            </div>

            <div className="flex items-center space-x-1.5 bg-[#1C1C1C]/5 px-2.5 py-1.5 rounded-none border border-[#1C1C1C]/10 text-[11px] md:text-xs">
              <Cpu className="w-3.5 h-3.5 text-gray-600 shrink-0" />
              <span className="font-mono text-gray-500 uppercase">
                AI: {provider === "gemini" ? "gemini-2.5-flash" : "mistral-pixtral"}
              </span>
            </div>

            {user && (
              <div className="flex items-center space-x-2 bg-[#1C1C1C]/5 pl-2.5 pr-1.5 py-1.5 border border-[#1C1C1C]/10 text-[11px] md:text-xs">
                <span className="font-mono text-gray-700 truncate max-w-[120px] sm:max-w-none">
                  {user.displayName} {profile ? `(Kredity: ${profile.credits})` : ""}
                </span>
                <button 
                  onClick={handleLogout}
                  title="Odhlásiť sa"
                  className="p-1 hover:bg-[#1C1C1C]/10 text-gray-500 hover:text-red-600 cursor-pointer shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Explicit login bypass / Google trigger buttons */}
          <div className="flex flex-wrap gap-2 w-full lg:w-auto justify-start lg:justify-end">
            {!isFirebaseConfigured ? (
              <button 
                id="bypass-login-btn"
                onClick={handleBypassGuestLogin}
                className="flex-1 lg:flex-none text-center bg-[#1C1C1C] text-white hover:bg-[#1C1C1C]/90 px-3.5 py-2 text-[11px] font-mono uppercase tracking-wider transition-all select-none cursor-pointer"
              >
                Hosťovský režim s obídením
              </button>
            ) : (
              <>
                <button 
                  id="google-login-btn"
                  onClick={handleGoogleLogin}
                  className="flex-1 lg:flex-none text-center bg-white border border-[#1C1C1C] text-gray-900 hover:bg-gray-100 px-3.5 py-2 text-[11px] font-mono uppercase tracking-wider transition-all cursor-pointer"
                >
                  Google Prihlásenie
                </button>
                <button 
                  id="bypass-guest-btn"
                  onClick={handleBypassGuestLogin}
                  className="flex-1 lg:flex-none text-center bg-[#1C1C1C] text-white hover:bg-[#1C1C1C]/90 px-3.5 py-2 text-[11px] font-mono uppercase tracking-wider transition-all cursor-pointer"
                >
                  Lokálny Bypass (Hosť)
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* DETAILED COST & CREDIT SIMULATOR BANNER (Requirement 4) */}
      <section className="bg-white border-b border-[#1C1C1C]/10 py-4 px-6 md:px-12 select-none">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-xs font-mono tracking-wider text-gray-400 uppercase flex items-center space-x-1.5">
              <Coins className="w-3.5 h-3.5 text-black" />
              <span>Simulátor Nákladov & Free-Tier Kvót (Spark Plan)</span>
            </h2>
            <p className="text-xs text-gray-500">
              Sledujte reálnu úsporu a vyťaženosť bezplatných volaní pred spoplatnením. Firestore čítané operácie sú minimalizované vyrovnávacou pamäťou.
            </p>
          </div>

          {/* Quota Indicators */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAF8F5] p-3 border border-[#1C1C1C]/5 w-full md:w-auto">
            <div className="space-y-0.5">
              <span className="block text-[9px] font-mono text-gray-400 uppercase leading-none">Firestore Reads</span>
              <strong className="block text-sm font-mono text-gray-800 font-semibold">{metrics.firestoreReads} <span className="text-[10px] text-gray-400">/ 50k p.d</span></strong>
            </div>
            <div className="space-y-0.5">
              <span className="block text-[9px] font-mono text-gray-400 uppercase leading-none">Firestore Writes</span>
              <strong className="block text-sm font-mono text-gray-800 font-semibold">{metrics.firestoreWrites} <span className="text-[10px] text-gray-400">/ 20k p.d</span></strong>
            </div>
            <div className="space-y-0.5">
              <span className="block text-[9px] font-mono text-gray-400 uppercase leading-none">Gemini Requests</span>
              <strong className="block text-sm font-mono text-gray-800 font-semibold">{metrics.geminiRequestsCount} <span className="text-[10px] text-gray-400">/ 15 p.m</span></strong>
            </div>
            <div className="space-y-0.5">
              <span className="block text-[9px] font-mono text-gray-400 uppercase leading-none">Simulated Cost</span>
              <strong className="block text-sm font-mono text-green-700 font-bold">&#8364; {metrics.estimatedCostEur.toFixed(5)}</strong>
            </div>
          </div>

          {/* Test Operations Force Simulators */}
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button 
              onClick={handleResetMetrics}
              className="px-2.5 py-1.5 border border-[#1C1C1C]/10 hover:bg-[#1C1C1C]/5 text-[10px] font-mono uppercase tracking-wider text-gray-600 transition-all ml-auto md:ml-0 cursor-pointer"
              title="Obnoviť nasekané kredity a vymazať štatistiky"
            >
              Nulovať Metriky
            </button>
            <button 
              onClick={() => triggerSimulationError("quota429")}
              className="px-2.5 py-1.5 border border-amber-600/20 text-amber-800 hover:bg-amber-600/5 text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer"
            >
              Sim 429
            </button>
            <button 
              onClick={() => triggerSimulationError("rules403")}
              className="px-2.5 py-1.5 border border-red-600/20 text-red-800 hover:bg-red-600/5 text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer"
            >
              Sim 403
            </button>
          </div>
        </div>
      </section>

      {/* CORE WORKSPACE BENTO GRID */}
      <main className="flex-1 w-full max-w-7xl mx-auto py-4 md:py-8 px-4 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: DESIGN INPUT MODULE (Width: 5/12) */}
        <section className="lg:col-span-5 bg-white border border-[#1C1C1C]/10 shadow-sm p-4 md:p-8 flex flex-col justify-between">
          <div className="space-y-6">
            
            <div className="pb-4 border-b border-[#1C1C1C]/10 flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="font-display font-semibold text-lg text-gray-900 leading-tight">Konfigurátor Návrhu</h3>
                <p className="text-xs text-gray-500">Zadajte parametre priestoru a nahrajte pôvodné foto.</p>
              </div>
              <Sparkles className="w-5 h-5 text-gray-400" />
            </div>

            {/* AI Model Provider Selector */}
            <div className="space-y-2 bg-[#FAF9F6] p-3 border border-[#1C1C1C]/5">
              <label className="block text-xs font-mono tracking-wider uppercase text-gray-500">
                AI Poskytovateľ (Model)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setProvider("gemini")}
                  className={`py-2 px-1 text-xs font-mono uppercase border transition-all text-center cursor-pointer ${
                    provider === "gemini" 
                      ? "bg-[#1C1C1C] text-[#FAF9F6] border-[#1C1C1C]" 
                      : "bg-white text-gray-700 border-gray-200 hover:bg-[#1C1C1C]/5"
                  }`}
                >
                  Gemini API
                </button>
                <button
                  onClick={() => setProvider("mistral")}
                  className={`py-2 px-1 text-xs font-mono uppercase border transition-all text-center cursor-pointer ${
                    provider === "mistral" 
                      ? "bg-[#1C1C1C] text-[#FAF9F6] border-[#1C1C1C]" 
                      : "bg-white text-gray-700 border-gray-200 hover:bg-[#1C1C1C]/5"
                  }`}
                >
                  Mistral AI
                </button>
              </div>
              <p className="text-[10px] text-gray-400 italic">
                {provider === "gemini" 
                  ? "Používa Gemini 1.5/2.5 Flash na bleskovú multimodálnu analýzu." 
                  : "Používa Mistral API (Pixtral-12B pre obrázky, Mistral Large pre štruktúrovaný text)."}
              </p>
            </div>

            {/* 1. Select Room Type */}
            <div className="space-y-2">
              <label className="block text-xs font-mono tracking-wider uppercase text-gray-500">
                Typ Miestnosti
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {["Obývacia izba", "Spálňa", "Kuchyňa", "Kúpeľňa"].map((room) => (
                  <button
                    key={room}
                    onClick={() => setRoomType(room)}
                    className={`py-2 px-1 text-xs font-mono uppercase border transition-all text-center cursor-pointer ${
                      roomType === room 
                        ? "bg-[#1C1C1C] text-[#FAF9F6] border-[#1C1C1C]" 
                        : "bg-white text-gray-700 border-gray-200 hover:bg-[#1C1C1C]/5"
                    }`}
                  >
                    {room}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Style selector with curated descriptions */}
            <div className="space-y-2">
              <label className="block text-xs font-mono tracking-wider uppercase text-gray-500">
                Dizajnová Estetika (Swiss Style)
              </label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full bg-white border border-[#1C1C1C]/10 py-2 px-3 text-xs font-sans focus:outline-none focus:border-[#1C1C1C] rounded-none text-gray-800"
              >
                <option value="Swiss-Minimalist">Swiss-Minimalist (prísny, haptický, funkčný)</option>
                <option value="Japandi">Japandi (hrejivý minimalizmus, organické tvary)</option>
                <option value="Nordic">Nordic (bielené drevo, vzdušné svetlo, severský akcent)</option>
                <option value="Industrial">Industrial (čistý kov, hrubé tehlové štruktúry)</option>
              </select>
              <p className="text-[10px] text-gray-400 italic">
                {style === "Swiss-Minimalist" && "Swiss-Minimalist uprednostňuje pravouhlé členenia, precíznu sieť, neutrálne tóny a vysokokvalitné striedme materiály."}
                {style === "Japandi" && "Japandi tlmí chlad minimalizmu zjemneným bambusovým nábytkom a keramickými akcentmi."}
                {style === "Nordic" && "Nordic sa zameriava na maximalizáciu bielej refrakcie denného svetla a svetlé lesy."}
                {style === "Industrial" && "Industrial kombinuje brúsené ocelové rámy a holú stavebnú podstatu stien."}
              </p>
            </div>

            {/* 3. Budget selector */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-mono tracking-wider uppercase text-gray-500">
                  Cieľový Rozpočet
                </label>
                <span className="text-xs font-mono font-bold">{budget} EUR</span>
              </div>
              <input
                type="range"
                min="500"
                max="15000"
                step="250"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full h-1 bg-[#1C1C1C]/10 appearance-none cursor-pointer accent-[#1C1C1C]"
              />
              <div className="flex justify-between text-[10px] font-mono text-gray-400">
                <span>500 €</span>
                <span>Základ (IKEA)</span>
                <span>Prem. (Custom)</span>
                <span>15000 €</span>
              </div>
            </div>

            {/* 4. DRAG-AND-DROP PRE-COMPRESSION PHOTO UPLODER */}
            <div className="space-y-2">
              <label className="block text-xs font-mono tracking-wider uppercase text-gray-500">
                Fotografia Pôvodného Priestoru
              </label>
              
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-none p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px] select-none ${
                  isDragging 
                    ? "border-[#1C1C1C] bg-[#1C1C1C]/5" 
                    : "border-gray-200 hover:border-gray-400 bg-[#FAF9F6]/50"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => e.target.files && processImageFile(e.target.files[0])}
                  className="hidden"
                  accept="image/*"
                />

                <Upload className="w-6 h-6 text-gray-400 mb-2" />
                
                {imageSrc ? (
                  <div className="space-y-1">
                    <span className="block text-xs font-semibold text-green-700">Obrázok bol spracovaný</span>
                    {uploadProgress && (
                      <span className="block text-[10px] font-mono text-gray-400">
                        {uploadProgress.originalSize} ➔ <b className="text-gray-900">{uploadProgress.compressedSize}</b> ({uploadProgress.savedPercent}% ušetrených)
                      </span>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-medium text-gray-700">Potiahnite obrázok sem alebo kliknite</p>
                    <p className="text-[10px] text-gray-400 mt-1">Automaticky zmenšíme mierku a kvalitu pre šetrenie free kvót</p>
                  </div>
                )}
              </div>

              {/* Instant predefined sample trigger (Bypass template) */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-gray-400 font-mono uppercase">Nemáte vlastné foto?</span>
                <button 
                  onClick={() => selectPredefinedImage(roomType)}
                  className="text-[10px] text-[#1C1C1C] font-mono underline uppercase hover:no-underline cursor-pointer"
                >
                  Použiť šablónu izby ➔
                </button>
              </div>
            </div>

          </div>

          {/* Action Trigger Button */}
          <div className="pt-6 mt-8 border-t border-[#1C1C1C]/10">
            <button
              id="analyze-submit-btn"
              onClick={handleSubmitRedesign}
              disabled={loading}
              className="w-full bg-[#1C1C1C] text-white hover:bg-black/90 disabled:bg-gray-300 py-3 text-xs font-mono uppercase tracking-widest transition-all cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Spracovávam...</span>
                </div>
              ) : (
                "Analyzovať & Navrhnúť Redizajn"
              )}
            </button>
          </div>

        </section>

        {/* RIGHT COLUMN: INTERACTIVE VISUALIZER & RESULTS PANEL (Width: 7/12) */}
        <section className="lg:col-span-7 bg-white border border-[#1C1C1C]/10 shadow-sm flex flex-col overflow-hidden min-h-[500px]">
          
          {/* RESULTS DISPLAY LOADING COVER */}
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white/95 select-none animate-fade-in relative z-20">
              <div className="w-16 h-16 border border-[#1C1C1C]/10 flex items-center justify-center mb-6 relative">
                <div 
                  className="absolute inset-0 border-2 border-t-[#1C1C1C] border-b-transparent border-l-transparent border-r-transparent animate-spin" 
                  style={{ animationDuration: '0.8s' }}
                />
                <Building className="w-6 h-6 text-[#1C1C1C]" />
              </div>
              
              <h3 className="font-display font-medium text-lg mb-1 text-center">AI Redizajnujeme tvoj Priestor...</h3>
              
              {/* Dynamic Subheader based on the phase */}
              <p className="text-xs font-mono text-[#1C1C1C]/60 mb-6 uppercase tracking-wider">
                {progress < 25 && "1. Skenovanie & Pôdorys"}
                {progress >= 25 && progress < 50 && "2. Modelovanie Perspektívy"}
                {progress >= 50 && progress < 75 && "3. Rozvrhnutie Interiéru"}
                {progress >= 75 && "4. Fotorealistické Finišovanie"}
              </p>

              {/* Minimalist Progress Meter Container */}
              <div className="w-full max-w-md bg-gray-100 border border-gray-200/60 p-5 mb-6 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-mono font-medium text-gray-400 uppercase tracking-widest">
                    Postup Výpočtu
                  </span>
                  <span className="text-xs font-mono font-semibold text-[#1C1C1C] bg-[#1C1C1C]/5 px-2 py-0.5 border border-[#1C1C1C]/10">
                    {Math.round(progress)}%
                  </span>
                </div>

                {/* Actual Bar */}
                <div className="w-full h-2 bg-gray-200/80 overflow-hidden relative">
                  <div 
                    className="h-full bg-gradient-to-r from-gray-700 to-[#1C1C1C] transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Subliminal status message ticker */}
                <div className="mt-4 min-h-[16px] flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    <motion.p 
                      key={loadingMessageIndex}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.25 }}
                      className="text-[11px] font-mono text-gray-500 text-center"
                    >
                      {SUBLIMINAL_MESSAGES[loadingMessageIndex]}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>

              {/* Progress Stage Nodes */}
              <div className="w-full max-w-sm grid grid-cols-4 gap-2 mb-2">
                {[
                  { label: "Skenovanie", minP: 0 },
                  { label: "Štruktúra", minP: 25 },
                  { label: "Zariadenie", minP: 50 },
                  { label: "Vizualizácia", minP: 75 }
                ].map((stg, sIdx) => {
                  const isActive = progress >= stg.minP;
                  const isCompleted = progress >= (sIdx === 3 ? 98 : [25, 50, 75][sIdx]);
                  return (
                    <div key={stg.label} className="flex flex-col items-center text-center">
                      <div className={`w-3.5 h-3.5 rounded-full border border-2 flex items-center justify-center mb-1.5 transition-colors duration-300 ${
                        isCompleted 
                          ? 'bg-[#1C1C1C] border-[#1C1C1C]' 
                          : isActive 
                            ? 'bg-amber-500/10 border-amber-500 animate-pulse' 
                            : 'bg-white border-gray-200'
                      }`}>
                        {isCompleted && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <span className={`text-[9px] font-mono tracking-wider transition-colors duration-300 uppercase ${
                        isActive ? 'text-[#1C1C1C] font-semibold' : 'text-gray-400'
                      }`}>
                        {stg.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {retryTimerActive && (
                <span className="text-[10px] font-mono text-amber-600 bg-amber-50 px-2.5 py-1 uppercase tracking-wider border border-amber-200 mt-4 animate-pulse">
                  Automatický pokus o: {countdown}s
                </span>
              )}
            </div>
          )}

          {/* EMPTY / INITIAL SCREEN (Prior to generation) */}
          {!analysisResult && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center select-none bg-[#FAF9F6]/50">
              <div className="w-12 h-12 bg-[#1C1C1C]/5 flex items-center justify-center mb-4">
                <Building className="w-5 h-5 text-gray-500" />
              </div>
              <h4 className="font-display font-medium text-sm text-gray-900 mb-1">Žiadny generovaný návrh</h4>
              <p className="text-xs text-gray-400 max-w-xs mb-6">
                Chýbajú údaje na zobrazenie. Skonfigurujte požiadavku, nahrajte fotografiu izby a stlačte tlačidlo na spustenie AI.
              </p>

              {/* Sample loader */}
              <div className="border border-[#1C1C1C]/10 p-4 bg-white max-w-sm text-left">
                <h5 className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-2">Rýchly štart s Mockupom:</h5>
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                  Ak nemáte kľúč, naša aplikácia plynulo zosníma šablónu, simuluje odoslanie a vykreslí špičkové interaktívne rozloženie do 2 sekúnd.
                </p>
                <button 
                  onClick={() => {
                    selectPredefinedImage("Obývacia izba");
                    // Wait a moment and submit
                    setTimeout(() => handleSubmitRedesign(), 200);
                  }}
                  className="bg-[#1C1C1C] hover:bg-black text-[#FAF9F6] text-[10px] font-mono uppercase px-3 py-1.5 transition-all w-full text-center cursor-pointer"
                >
                  Načítať Ukážku Obývačky
                </button>
              </div>
            </div>
          )}

          {/* MAIN OUTPUT READY CONTENT */}
          {analysisResult && !loading && (
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* TABS NAVBAR */}
              <div className="bg-white border-b border-[#1C1C1C]/10 flex select-none shrink-0 overflow-x-auto">
                <button
                  onClick={() => setActiveTab("visual-compare")}
                  className={`flex-1 py-4 px-3 text-xs font-mono uppercase tracking-wider border-b-2 transition-all flex items-center justify-center space-x-2 cursor-pointer whitespace-nowrap ${
                    activeTab === "visual-compare" 
                      ? "border-[#1C1C1C] text-black bg-white font-semibold" 
                      : "border-transparent text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100/50"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Pred & Po Vizuál</span>
                </button>

                <button
                  onClick={() => setActiveTab("blueprint")}
                  className={`flex-1 py-4 px-3 text-xs font-mono uppercase tracking-wider border-b-2 transition-all flex items-center justify-center space-x-2 cursor-pointer whitespace-nowrap ${
                    activeTab === "blueprint" 
                      ? "border-[#1C1C1C] text-black bg-white font-semibold" 
                      : "border-transparent text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100/50"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>2D Plán Návrhu</span>
                </button>

                <button
                  onClick={() => setActiveTab("analysis")}
                  className={`flex-1 py-4 px-3 text-xs font-mono uppercase tracking-wider border-b-2 transition-all flex items-center justify-center space-x-2 cursor-pointer whitespace-nowrap ${
                    activeTab === "analysis" 
                      ? "border-[#1C1C1C] text-black bg-white font-semibold" 
                      : "border-transparent text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100/50"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Architektonická Analýza</span>
                </button>

                <button
                  onClick={() => setActiveTab("shopping")}
                  className={`flex-1 py-4 px-3 text-xs font-mono uppercase tracking-wider border-b-2 transition-all flex items-center justify-center space-x-2 cursor-pointer whitespace-nowrap ${
                    activeTab === "shopping" 
                      ? "border-[#1C1C1C] text-black bg-white font-semibold" 
                      : "border-transparent text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100/50"
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Nákupný Zoznam</span>
                </button>
              </div>

              {/* ACTIVE VIEWPORT PORTAL */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8 min-h-[400px]">
                
                {/* 0. BEFORE & AFTER VISUAL COMPARISON TAB */}
                {activeTab === "visual-compare" && (
                  <div className="space-y-8 animate-fade-in text-gray-900">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                      <div>
                        <h4 className="font-display font-semibold text-lg text-gray-900 leading-tight">
                          Odhadovaný Výsledný Po Vizuál (Pred & Po)
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">
                          Vyvážené interaktívne usporiadanie nábytku v štýle <span className="font-mono text-black font-semibold uppercase">{style}</span> rešpektujúce pôvodné dispozičné rozmery miestnosti.
                        </p>
                      </div>

                      {/* Info card of current setup with action button to save stacked before/after images */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                        <div className="bg-[#FAF8F5] border border-[#1C1C1C]/10 px-3 py-2 text-[11px] font-mono">
                          <span className="text-gray-400 uppercase block text-[9px]">Zvolená Dispozícia</span>
                          <span className="text-black font-semibold">{roomType} • {style}</span>
                        </div>
                        <button
                          onClick={handleExportStackedComparison}
                          disabled={isExportingComparison}
                          className="flex items-center justify-center space-x-2 bg-[#1C1C1C] hover:bg-black text-[#FAF9F6] hover:text-white px-4 py-2.5 text-xs font-mono uppercase tracking-wider transition-all select-none cursor-pointer border border-[#1C1C1C] disabled:opacity-50 active:scale-95 text-center leading-none"
                          title="Uložiť a stiahnuť porovnanie obrázkov pod sebou pre lepšiu prehľadnosť"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{isExportingComparison ? "Export..." : "Uložiť Pred & Po (Pod Sebou)"}</span>
                        </button>
                      </div>
                    </div>

                    {/* INTERACTIVE COMPARISON BLOCK */}
                    <div className="space-y-6">
                      {/* Interactive toggle header for modes */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/80 p-4 border border-[#1C1C1C]/10 rounded-xs">
                        <div className="space-y-1">
                          <span className="text-xs font-mono tracking-wider text-gray-400 uppercase block font-semibold">
                            Interaktívny Nástroj Porovnania
                          </span>
                          <p className="text-[11px] text-gray-500">
                            Vyberte si medzi bočným rezom (Split) a prelínaním (Overlay s opacitou) na detailné posúdenie zmien.
                          </p>
                        </div>
                        <div className="flex items-center space-x-1 bg-white p-1 border border-[#1C1C1C]/10 self-start sm:self-auto shrink-0 select-none">
                          <button
                            onClick={() => setCompareMode("split")}
                            className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider cursor-pointer transition-all flex items-center space-x-1.5 ${
                              compareMode === "split"
                                ? "bg-[#1C1C1C] text-white font-semibold"
                                : "text-gray-600 hover:text-black hover:bg-gray-50"
                            }`}
                          >
                            <span>↔ Bočný Rez (Split)</span>
                          </button>
                          <button
                            onClick={() => setCompareMode("overlay")}
                            className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider cursor-pointer transition-all flex items-center space-x-1.5 ${
                              compareMode === "overlay"
                                ? "bg-[#1C1C1C] text-white font-semibold"
                                : "text-gray-600 hover:text-black hover:bg-gray-50"
                            }`}
                          >
                            <Layers className="w-3 h-3" />
                            <span>Prekrytie (Overlay)</span>
                          </button>
                        </div>
                      </div>

                      {compareMode === "split" ? (
                        <div className="space-y-4">
                          <div className="relative aspect-video w-full max-w-4xl mx-auto overflow-hidden border border-[#1C1C1C]/10 shadow-md bg-gray-100 select-none">
                            
                            {/* RIGHT IMAGE (AFTER): Gorgeous Redesigned rendering */}
                            <img 
                              src={customAfterUrl || (AFTER_IMAGES_MAPPING[roomType]?.[style] || "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80")} 
                              alt="Po redizajne" 
                              className="absolute inset-0 w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute top-4 right-4 bg-[#1C1C1C]/80 backdrop-blur-xs px-2.5 py-1 text-[10px] text-white font-mono uppercase tracking-wider select-none z-10 border border-white/20">
                              {customAfterUrl ? "Po (Vlastný AI Vizuál)" : "Po (Architektonický Návrh)"}
                            </div>

                            {/* LEFT IMAGE (BEFORE): Original design (with a clip-path revealing based on slider position) */}
                            <div 
                              className="absolute inset-y-0 left-0 overflow-hidden z-25"
                              style={{ width: `${sliderPosition}%` }}
                            >
                              <img 
                                src={imageSrc || "https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?auto=format&fit=crop&w=1200&q=80"} 
                                alt="Pred úpravou" 
                                className="absolute inset-0 w-full h-full object-cover" 
                                style={{ width: "100%", maxWidth: "none" }}
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-xs px-2.5 py-1 text-[10px] text-[#1C1C1C] font-mono uppercase tracking-wider select-none z-10 border border-black/10">
                              Pred (Pôvodný Stav)
                            </div>

                            {/* SLIDER CONTROLLER SPLIT BAR */}
                            <div 
                              className="absolute inset-y-0 w-1 bg-white cursor-ew-resize z-30 shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                              style={{ left: `${sliderPosition}%` }}
                            >
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white text-black shadow-lg flex items-center justify-center font-bold text-xs select-none">
                                ↔
                              </div>
                            </div>

                            {/* HIDDEN INVISIBLE RANGE INPUT OVERLAY FOR ULTRA SMOOTH INTERACTION */}
                            <input 
                              type="range" 
                              min="0" 
                              max="100" 
                              value={sliderPosition} 
                              onChange={(e) => setSliderPosition(Number(e.target.value))}
                              className="absolute inset-0 opacity-0 w-full h-full cursor-ew-resize z-40"
                            />
                          </div>

                          {/* SLIDER ASSISTANCE */}
                          <div className="flex justify-between text-[11px] font-mono text-gray-400 px-1 max-w-4xl mx-auto">
                            <span>← Pôvodný poškodený/prázdny stav</span>
                            <span className="animate-pulse text-gray-500 font-semibold">Tiahnite myšou/kliknite na plochu pre rez</span>
                            <span>Nový Swiss Minimalistický vizuál →</span>
                          </div>
                        </div>
                      ) : (
                        /* OVERLAY STATE COMPONENT WITH HIGH FIDELITY OPACITY TRANSITION */
                        <div className="space-y-4">
                          <div className="relative aspect-video w-full max-w-4xl mx-auto overflow-hidden border border-[#1C1C1C]/10 shadow-md bg-gray-100 select-none">
                            {/* Base Image: Before */}
                            <img 
                              src={imageSrc || "https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?auto=format&fit=crop&w=1200&q=80"} 
                              alt="Pred úpravou" 
                              className="absolute inset-0 w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-xs px-2.5 py-1 text-[10px] text-[#1C1C1C] font-mono uppercase tracking-wider select-none z-10 border border-black/10">
                              Pred (Pôvodný Stav)
                            </div>

                            {/* Overlay Image: After with inline style controlled opacity */}
                            <div 
                              className="absolute inset-0 transition-opacity duration-75 ease-out"
                              style={{ opacity: overlayOpacity / 100 }}
                            >
                              <img 
                                src={customAfterUrl || (AFTER_IMAGES_MAPPING[roomType]?.[style] || "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80")} 
                                alt="Po redizajne" 
                                className="absolute inset-0 w-full h-full object-cover" 
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div 
                              className="absolute top-4 right-4 bg-[#1C1C1C]/80 backdrop-blur-xs px-2.5 py-1 text-[10px] text-white font-mono uppercase tracking-wider select-none z-10 border border-white/20 transition-opacity duration-150"
                              style={{ opacity: Math.max(0.4, overlayOpacity / 100) }}
                            >
                              {customAfterUrl ? "Po (Vlastný AI Vizuál)" : "Po (Architektonický Návrh)"}
                            </div>

                            {/* Center-Bottom opacity value display badge */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#1C1C1C]/90 backdrop-blur-xs px-3 py-1 border border-white/10 text-[10px] font-mono text-white text-center z-10 select-none">
                              Priehľadnosť: <span className="text-amber-400 font-bold">{overlayOpacity}%</span>
                            </div>
                          </div>

                          {/* SLIDER CONTROL STATION */}
                          <div className="bg-[#FAF8F5] border border-[#1C1C1C]/10 p-5 max-w-4xl mx-auto">
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                              <div className="flex items-center space-x-3">
                                <span className="p-2 bg-[#1C1C1C]/5 border border-[#1C1C1C]/10 text-gray-700">
                                  <Layers className="w-4 h-4" />
                                </span>
                                <div>
                                  <span className="text-xs font-mono font-bold uppercase text-gray-700 block">Prelínanie Obrázkov</span>
                                  <span className="text-[10px] text-gray-400">Posúvaním meníte viditeľnosť nového dizajnu</span>
                                </div>
                              </div>

                              <div className="w-full sm:w-72 flex items-center space-x-3 select-none">
                                <span className="text-[10px] font-mono text-gray-400 uppercase">Pred (0%)</span>
                                <input 
                                  type="range" 
                                  min="0" 
                                  max="100" 
                                  value={overlayOpacity} 
                                  onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                                  className="flex-1 accent-[#1C1C1C] h-1 bg-gray-200 cursor-ew-resize"
                                />
                                <span className="text-[10px] font-mono text-black font-semibold uppercase">Po ({overlayOpacity}%)</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* PROMPT GENERATION TOOL FOR MISTRAL / MIDJOURNEY GENERATORS */}
                    <div className="bg-[#FAF8F5] border border-[#1C1C1C]/10 p-6 space-y-6">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="space-y-1">
                          <h5 className="font-display font-semibold text-sm text-gray-900 uppercase tracking-wide flex items-center space-x-2">
                            <Sparkles className="w-4 h-4 text-black shrink-0" />
                            <span>1. Systémový Prompt pre AI Obrázkové Modelovanie</span>
                          </h5>
                          <p className="text-xs text-gray-500 max-w-2xl leading-relaxed">
                            Skopírujte si tento precízne vygenerovaný prompt a zadajte ho do vášho AI obrázkového generátora (napr. Mistral, Midjourney v6, Stable Diffusion XL alebo DALL-E 3). Tento prompt garantuje zachovanie presných rozmerov miestnosti, dĺžky a šírky stien.
                          </p>
                        </div>

                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(generateImgPrompt());
                            setCopiedPrompt(true);
                            setTimeout(() => setCopiedPrompt(false), 2000);
                          }}
                          className={`py-2 px-4 text-xs font-mono uppercase tracking-wider shrink-0 transition-all cursor-pointer flex items-center space-x-2 border border-[#1C1C1C] ${
                            copiedPrompt 
                              ? "bg-green-600 text-white border-green-600 font-bold" 
                              : "bg-[#1C1C1C] text-[#FAF9F6] border-[#1C1C1C] hover:bg-black font-semibold"
                          }`}
                        >
                          {copiedPrompt ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Skopírované!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Kopírovať Prompt</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* VIEW OF THE PROMPT */}
                      <div className="bg-white border border-[#1C1C1C]/10 p-4 font-mono text-xs text-gray-700 whitespace-pre-wrap select-all leading-relaxed relative max-h-[160px] overflow-y-auto">
                        {generateImgPrompt()}
                      </div>

                      {/* OVERRIDE WITH REAL PHOTO GENERATOR */}
                      <div className="pt-2 border-t border-[#1C1C1C]/5 space-y-4">
                        <div className="space-y-1">
                          <label className="text-xs font-mono tracking-wider text-gray-500 uppercase block font-bold">
                            2. Testovanie s Vaším vygenerovaným real photo návrhom
                          </label>
                          <p className="text-[11px] text-gray-400">
                            Vložte URL alebo odkaz na vašu vygenerovanú fotografiu (napr. z Discordu, Imgbb, Pinterestu) a okamžite ju prepojte so schémou priestoru.
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="https://odkaz-na-obrazok.jpg" 
                            value={customAfterUrl || ""}
                            onChange={(e) => setCustomAfterUrl(e.target.value || null)}
                            className="flex-1 bg-white border border-[#1C1C1C]/10 py-2 px-3 text-xs font-mono focus:outline-none focus:border-[#1C1C1C] rounded-none text-gray-800"
                          />
                          {customAfterUrl && (
                            <button 
                              onClick={() => setCustomAfterUrl(null)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 text-xs font-mono border border-red-200 uppercase transition-all whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* 1. ARCHITECTURAL BLUEPRINT 2D SCHEMATIC CANVAS */}
                {activeTab === "blueprint" && (
                  <div className="space-y-6 animate-fade-in text-gray-900">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="font-display font-semibold text-lg text-gray-900 leading-tight">
                          Interaktívna architektonická schéma
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">
                          Dotykom alebo podržaním myši na karte/plániku si prezrite detaily osadenia jednotlivých modulov.
                        </p>
                      </div>
                      
                      {/* Compass and grid scale marker */}
                      <div className="text-right shrink-0 flex flex-col items-end gap-2">
                        <div className="text-right">
                          <span className="block text-[10px] font-mono text-gray-400 uppercase">Mierka: 1:50</span>
                          <span className="block text-[10px] font-mono text-gray-400 uppercase">Sever: ↑</span>
                        </div>
                        <button
                          onClick={handleExportBlueprint}
                          className="flex items-center space-x-1.5 bg-[#1C1C1C] hover:bg-black text-[#FAF9F6] px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-all select-none cursor-pointer shadow-sm rounded-none active:scale-95 touch-manipulation"
                          title="Exportovať nákres ako obrázok JPEG"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Export (JPEG)</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                      
                      {/* Map Schema Canvas */}
                      <div className="md:col-span-8 bg-[#FAF9F6] border border-[#1C1C1C]/10 p-4 relative select-none">
                        <div className="relative aspect-square w-full bg-white border border-[#1C1C1C]/15 overflow-hidden shadow-inner">
                          
                          {/* Sizing rulers on layout margins for technical aesthetic (JetBrains Mono specifications) */}
                          <div className="absolute top-0 left-0 right-0 h-3 blueprint-ruler-x bg-gray-50/50 border-b border-gray-100" />
                          <div className="absolute top-0 left-0 bottom-0 w-3 blueprint-ruler-y bg-gray-50/50 border-r border-gray-100" />
                          <div className="absolute bottom-2 right-2 text-[9px] font-mono text-gray-300">SWISS ARCH GRID</div>

                          {/* Render current spatial item coordinates */}
                          {analysisResult.furnitureLayout?.map((item, idx) => {
                            const isHovered = hoveredFurniture?.name === item.name || selectedFurniture?.name === item.name;
                            return (
                              <button
                                key={idx}
                                onMouseEnter={() => setHoveredFurniture(item)}
                                onMouseLeave={() => setHoveredFurniture(null)}
                                onClick={() => setSelectedFurniture(selectedFurniture?.name === item.name ? null : item)}
                                onFocus={() => setHoveredFurniture(item)}
                                onBlur={() => setHoveredFurniture(null)}
                                style={{
                                  left: `${Math.max(10, Math.min(85, item.coordinateX))}%`,
                                  top: `${Math.max(10, Math.min(85, item.coordinateY))}%`,
                                }}
                                className="absolute -translate-x-1/2 -translate-y-1/2 group z-10 cursor-pointer focus:outline-none touch-manipulation"
                              >
                                {/* Interactive Dot */}
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-[10px] transition-all ${
                                  isHovered 
                                    ? "bg-[#1C1C1C] text-white scale-125 border-4 border-white shadow-md shadow-black/20" 
                                    : "bg-white text-gray-800 border-2 border-[#1C1C1C] hover:bg-[#1C1C1C] hover:text-white"
                                }`}>
                                  {idx + 1}
                                </div>
                                
                                {/* Label helper tooltip */}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 bg-white border border-black/10 px-2 py-1 text-[9px] font-sans rounded-none drop-shadow-sm whitespace-nowrap scale-0 group-hover:scale-100 group-focus:scale-100 origin-top transition-all text-gray-800 pointer-events-none z-30">
                                  {item.name}
                                </div>
                              </button>
                            );
                          })}

                          {/* Layout Wall Bounds simulation */}
                          <div className="absolute inset-x-8 inset-y-8 border bg-transparent pointer-events-none border-dashed border-gray-100" />
                          
                          {/* Dynamic Color Palette block represent on bottom plan for swiss aesthetics */}
                          <div className="absolute bottom-3 left-4 flex gap-1 z-10">
                            {analysisResult.colorPalette.map((col, cIdx) => (
                              <div 
                                key={cIdx} 
                                style={{ backgroundColor: col }}
                                className="w-3.5 h-3.5 border border-[#1C1C1C]/15" 
                                title={col}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Detail Inspection Card (Right side info of canvas) */}
                      <div className="md:col-span-4 space-y-4">
                        <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block font-bold leading-none">
                          Detail Vybraného Modulu
                        </span>

                        {(selectedFurniture || hoveredFurniture) ? (() => {
                          const activeItem = selectedFurniture || hoveredFurniture;
                          return (
                            <div className="bg-white border border-[#1C1C1C] p-4 select-none animate-fade-in space-y-3">
                              <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2">
                                <h5 className="font-semibold text-xs text-gray-900">{activeItem?.name}</h5>
                                <span className="bg-[#1C1C1C]/5 border border-[#1C1C1C]/10 px-1.5 py-0.5 text-[9px] font-mono text-gray-800 shrink-0">
                                  {activeItem?.category}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-600 leading-relaxed">
                                {activeItem?.description}
                              </p>
                              
                              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-1">
                                <div>
                                  <span className="text-gray-400 block pb-0.5">Rozmery v cm:</span>
                                  <span className="text-gray-800 block font-semibold">{activeItem?.width} × {activeItem?.depth}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400 block pb-0.5">Predpokladaná cena:</span>
                                  <span className="text-green-700 block font-bold">{activeItem?.estimatedPrice} EUR</span>
                                </div>
                              </div>
                              
                              <div className="pt-2 border-t border-gray-100 text-[10px] text-gray-500 font-sans">
                                Odporúčaný distribútor: <strong className="text-gray-800 font-medium">{activeItem?.storeRecommendation}</strong>
                              </div>
                            </div>
                          );
                        })() : (
                          <div className="bg-white border border-[#1C1C1C]/10 border-dashed p-6 text-center select-none text-gray-400 text-xs">
                            Kliknutím na body na pôdoryse vľavo si zobrazíte architektonické špecifikácie nábytku.
                          </div>
                        )}

                        {/* Summary of overall layout budget */}
                        <div className="bg-[#FAF8F5] border border-[#1C1C1C]/10 p-4 space-y-2 text-xs">
                          <span className="font-mono text-gray-400 uppercase tracking-wider block text-[9px]">DIZAJNOVÁ BILANCIA</span>
                          <div className="flex justify-between font-mono">
                            <span>Suma za položky:</span>
                            <span className="font-semibold text-gray-900">
                              {analysisResult.furnitureLayout.reduce((sum, item) => sum + item.estimatedPrice, 0)} EUR
                            </span>
                          </div>
                          <div className="flex justify-between font-mono pb-1">
                            <span>Váš limit:</span>
                            <span className="text-gray-500">{budget} EUR</span>
                          </div>
                          <div className="border-t border-gray-100 pt-1.5 flex justify-between font-sans">
                            <span>Zostatok v rezerve:</span>
                            <span className="font-bold text-green-700 font-mono">
                              {budget - analysisResult.furnitureLayout.reduce((sum, item) => sum + item.estimatedPrice, 0)} EUR
                            </span>
                          </div>
                        </div>

                      </div>

                    </div>
                  </div>
                )}

                {/* 2. STYLE, SUMMARY & COLOR SPACE CRITIQUE TAB */}
                {activeTab === "analysis" && (
                  <div className="space-y-8 animate-fade-in text-gray-900">
                    
                    {/* PDF Export Banner */}
                    <div className="bg-[#FAF8F5] border border-[#1C1C1C]/10 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="space-y-1 text-center sm:text-left">
                        <h4 className="font-display font-bold text-sm text-gray-900 flex items-center justify-center sm:justify-start space-x-2">
                          <FileText className="w-4 h-4 text-[#D97706]" />
                          <span>Kompletná Architektonická Štúdia v PDF</span>
                        </h4>
                        <p className="text-[11px] text-gray-500 max-w-lg">
                          Stiahnite si vysoko detailný, tlačený report s 2D plánom, odporúčanými materiálmi, farebným rozborom a kompletným nákupným zoznamom.
                        </p>
                      </div>
                      <button
                        onClick={handleExportPDFReport}
                        disabled={isExportingPDF}
                        id="export-pdf-report-btn-analysis"
                        className="w-full sm:w-auto px-5 py-2.5 bg-[#1C1C1C] text-white hover:bg-[#333333] font-mono text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isExportingPDF ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Generujem PDF...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Stiahnuť PDF Report</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Slovak critique segment */}
                    <div className="space-y-3">
                      <h4 className="font-display font-semibold text-lg text-gray-900 tracking-tight flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-black" />
                        <span>Kritické zhodnotenie a premena priestoru</span>
                      </h4>
                      <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line bg-gray-50 p-4 border-l-2 border-[#1C1C1C]">
                        {analysisResult.summary}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      
                      {/* Color Palette blocks */}
                      <div className="space-y-4">
                        <span className="text-xs font-mono tracking-wider text-gray-400 uppercase block font-bold">
                          10/30/60 Švajčiarske Farebné členenie
                        </span>
                        
                        <div className="flex flex-col gap-2">
                          {analysisResult.colorPalette.map((color, cIdx) => (
                            <div key={cIdx} className="flex items-center space-x-3 bg-[#FAF8F5] p-2 border border-[#1C1C1C]/5">
                              <div 
                                style={{ backgroundColor: color }}
                                className="w-8 h-8 border border-black/10 shadow-sm shrink-0"
                              />
                              <div className="flex-1 font-mono text-[11px]">
                                <span className="text-gray-800 block font-semibold">{color}</span>
                                <span className="text-gray-400 block text-[9px]">
                                  {cIdx === 0 && "Dominantný tón stien (60%)"}
                                  {cIdx === 1 && "Druhý základný tón nábytku (30%)"}
                                  {cIdx === 2 && "Akcentová haptická textúra (10%)"}
                                  {cIdx >= 3 && "Doplnkový harmonizujúci akcent"}
                                </span>
                              </div>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(color);
                                  alert(`Farba ${color} bola skopírovaná do schránky.`);
                                }}
                                className="text-[10px] font-mono text-gray-400 hover:text-black cursor-pointer uppercase underline hover:no-underline"
                              >
                                Kopírovať
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Materials List & lighting */}
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <span className="text-xs font-mono tracking-wider text-gray-400 uppercase block font-bold leading-none">
                            Odporúčané materiálové zloženie
                          </span>
                          <ul className="space-y-1.5">
                            {analysisResult.materials?.map((material, mIdx) => (
                              <li key={mIdx} className="text-xs text-gray-700 flex items-center space-x-2">
                                <span className="w-1.5 h-1.5 bg-black" />
                                <span>{material}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="space-y-3">
                          <span className="text-xs font-mono tracking-wider text-gray-400 uppercase block font-bold leading-none">
                            Tipy pre rozvrstvenie svetla
                          </span>
                          <p className="text-xs text-gray-600 leading-relaxed bg-[#FAF8F5] p-3 border border-gray-100 font-sans">
                            {analysisResult.lightingTips}
                          </p>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* 3. DETAILED SHOPPING LIST & DISCIPLINE SUM CHECKER TAB */}
                {activeTab === "shopping" && (
                  <div className="space-y-6 animate-fade-in text-gray-900 select-none">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                      <div>
                        <h4 className="font-display font-semibold text-lg text-gray-900 leading-tight">
                          Nákupný Zoznam
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Nábytok prísne prispôsobený slovenskej distribučnej sieti a cenovému tónu.
                        </p>
                      </div>
                    </div>

                    {/* PDF Export Banner */}
                    <div className="bg-[#FAF8F5] border border-[#1C1C1C]/10 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="space-y-1 text-center sm:text-left">
                        <h4 className="font-display font-bold text-sm text-gray-900 flex items-center justify-center sm:justify-start space-x-2">
                          <FileText className="w-4 h-4 text-[#D97706]" />
                          <span>Kompletná Architektonická Štúdia v PDF</span>
                        </h4>
                        <p className="text-[11px] text-gray-500 max-w-lg">
                          Stiahnite si vysoko detailný, tlačený report s 2D plánom, odporúčanými materiálmi, farebným rozborom a kompletným nákupným zoznamom.
                        </p>
                      </div>
                      <button
                        onClick={handleExportPDFReport}
                        disabled={isExportingPDF}
                        id="export-pdf-report-btn-shopping"
                        className="w-full sm:w-auto px-5 py-2.5 bg-[#1C1C1C] text-white hover:bg-[#333333] font-mono text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isExportingPDF ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Generujem PDF...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Stiahnuť PDF Report</span>
                          </>
                        )}
                      </button>
                    </div>

                    <span className="block md:hidden text-[9px] font-mono text-gray-500 bg-[#1C1C1C]/5 py-1.5 px-3 mb-2 text-center select-none animate-pulse uppercase tracking-wider">
                      ← Posuňte prstom vľavo/vpravo pre celú tabuľku →
                    </span>

                    <div className="overflow-x-auto scrollbar-thin">
                      <table className="w-full text-left border-collapse font-mono text-xs text-gray-700">
                        <thead>
                          <tr className="border-b border-[#1C1C1C]/15 text-gray-400 uppercase text-[10px]">
                            <th className="pb-3 pt-1">#</th>
                            <th className="pb-3 pt-1">Názov Položky</th>
                            <th className="pb-3 pt-1">Kategória</th>
                            <th className="pb-3 pt-1">Rozmery</th>
                            <th className="pb-3 pt-1">Distribútor</th>
                            <th className="pb-3 pt-1 text-right">Odhadovaná Cena</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysisResult.furnitureLayout?.map((item, idx) => (
                            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                              <td className="py-3.5 pr-2 font-bold">{idx + 1}</td>
                              <td className="py-3.5 pr-4 font-sans text-gray-900 font-medium">
                                <span className="block">{item.name}</span>
                                <span className="block text-[10px] text-gray-400 font-sans font-normal leading-tight mt-0.5 max-w-xs">{item.description}</span>
                              </td>
                              <td className="py-3.5 pr-4 text-gray-500">{item.category}</td>
                              <td className="py-3.5 pr-4">{item.width}x{item.depth} cm</td>
                              <td className="py-3.5 pr-4 text-gray-600 font-sans">{item.storeRecommendation}</td>
                              <td className="py-3.5 text-right font-bold text-gray-900">{item.estimatedPrice} EUR</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-[#1C1C1C] font-mono font-bold text-gray-900 bg-gray-50/50">
                            <td colSpan={5} className="py-4 text-right">ZHRNUTÉ EUR:</td>
                            <td className="py-4 text-right text-gray-950 text-sm">
                              {analysisResult.furnitureLayout.reduce((sum, item) => sum + item.estimatedPrice, 0)} EUR
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

              </div>
              
              {/* Reset view controller trigger / image thumbnail reference */}
              {imageSrc && (
                <div className="bg-[#FAF8F5] border-t border-[#1C1C1C]/10 py-3 px-6 shrink-0 flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center space-x-2">
                    <img src={imageSrc} className="w-8 h-8 object-cover border border-black/10" alt="Zdroje originál" />
                    <span>Aktívne analyzovaná fotografia</span>
                  </div>
                  <button 
                    onClick={() => {
                      setImageSrc(null);
                      setAnalysisResult(null);
                    }}
                    className="text-[#1C1C1C] font-mono uppercase underline hover:no-underline flex items-center space-x-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Zresetovať</span>
                  </button>
                </div>
              )}

            </div>
          )}

        </section>

      </main>

      {/* HISTORY / PREVIOUS DESIGN BOARDS (Persistence and offline recovery) */}
      <section className="bg-white border-t border-[#1C1C1C]/10 py-10 px-6 md:px-12 select-none">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center space-x-2 pb-2 border-b border-[#1C1C1C]/10">
            <History className="w-4 h-4 text-gray-500" />
            <h3 className="font-display font-semibold text-sm tracking-wider uppercase text-gray-800">Moje Predchádzajúce Redizajny</h3>
            {historyBoards.length > 0 && (
              <span className="text-[10px] bg-[#1C1C1C]/5 border border-[#1C1C1C]/10 text-gray-600 px-2 py-0.5 font-mono">
                {historyBoards.length} dosiek cached
              </span>
            )}
          </div>

          {historyBoards.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {historyBoards.map((board) => (
                <div 
                  key={board.id} 
                  onClick={() => handleSelectHistoryBoard(board)}
                  className="bg-[#FAF9F6] border border-[#1C1C1C]/10 p-3 hover:border-[#1C1C1C] transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="aspect-video w-full bg-white relative overflow-hidden border border-[#1C1C1C]/5 shadow-sm">
                      {board.originalImage ? (
                        <img 
                          src={board.originalImage} 
                          alt="Layout pôvod" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center font-mono text-[9px] text-gray-400">Sketch Base</div>
                      )}
                      
                      <div className="absolute top-1 left-1 bg-[#1C1C1C] text-[#FAF9F6] px-1 py-0.5 text-[8px] font-mono uppercase">
                        {board.roomType}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-xs text-gray-900 leading-tight truncate">{board.style}</h4>
                      <p className="text-[10px] font-mono text-gray-400 mt-1">Cena položiek: {JSON.parse(board.shoppingList).reduce((sum: number, cur: any) => sum + cur.estimatedPrice, 0)} EUR / Limit {board.budget} EUR</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[10px]">
                    <span className="text-gray-400 font-mono text-[8px]">
                      {new Date(board.createdAt).toLocaleDateString("sk-SK")}
                    </span>
                    <button 
                      onClick={(e) => handleDeleteHistoryBoard(e, board.id)}
                      className="text-gray-400 hover:text-red-700 p-1 cursor-pointer"
                      title="Vymazať z pamäte"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center font-sans text-xs text-gray-400 py-6">
              Zatiaľ ste nevytvorili žiadne Redizajn návrhy. Všetky úspešné nákupné zoznamy sa uchovávajú priamo tu.
            </div>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-[#1C1C1C]/10 py-6 px-6 md:px-12 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-[10px] text-gray-400 font-mono uppercase tracking-wider">
          <span>AI Redizajn Interiéru - Švajčiarska Precíznosť</span>
          <span>Coded for Google AI & Firebase Spark Plan limits clearance</span>
          <span>© 2026 kada.dakaj@gmail.com</span>
        </div>
      </footer>

    </div>
  );
}
