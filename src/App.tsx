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
  Download
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { isFirebaseConfigured, auth, loginAnonymously, loginWithGoogle, OperationType } from "./lib/firebase";
import { StorageService } from "./lib/storage";
import { DesignBoard, UserProfile, CostMetrics, RoomAnalysisResult, FurnitureLayoutItem } from "./types";

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

function MainDashboard() {
  // Authentication states
  const [user, setUser] = useState<{ uid: string; displayName: string; email: string; isAnonymous: boolean } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Form states
  const [roomType, setRoomType] = useState("Obývacia izba");
  const [style, setStyle] = useState("Swiss-Minimalist");
  const [budget, setBudget] = useState(2500);
  const [uploadProgress, setUploadProgress] = useState<{ originalSize: string; compressedSize: string; savedPercent: number } | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // UI views & outputs
  const [activeTab, setActiveTab] = useState<"analysis" | "blueprint" | "shopping">("blueprint");
  const [analysisResult, setAnalysisResult] = useState<RoomAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
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

  // Loading animation sequence
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % SUBLIMINAL_MESSAGES.length);
      }, 2200);
    }
    return () => clearInterval(interval);
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
              <span className="font-mono text-gray-500">
                AI: gemini-2.5-flash
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

            {/* 1. Select Room Type */}
            <div className="space-y-2">
              <label className="block text-xs font-mono tracking-wider uppercase text-gray-500">
                Typ Miestnosti
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["Obývacia izba", "Spálňa", "Kuchyňa"].map((room) => (
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
                <div className="absolute inset-0 border-2 border-t-[#1C1C1C] border-b-transparent border-l-transparent border-r-transparent animate-spin" />
                <Building className="w-6 h-6 text-[#1C1C1C]" />
              </div>
              <h3 className="font-display font-medium text-lg mb-2 text-center">AI Redizajnujeme tvoj Priestor...</h3>
              
              <AnimatePresence mode="wait">
                <motion.p 
                  key={loadingMessageIndex}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.3 }}
                  className="text-xs font-mono text-gray-500 text-center max-w-sm"
                >
                  {SUBLIMINAL_MESSAGES[loadingMessageIndex]}
                </motion.p>
              </AnimatePresence>

              {retryTimerActive && (
                <span className="text-[10px] font-mono text-amber-600 bg-amber-50 px-2.5 py-1 uppercase tracking-wider border border-amber-200 mt-4">
                  Doba obnovenia: {countdown}s
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
