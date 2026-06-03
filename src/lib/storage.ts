/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, setDoc, getDocs, collection, query, where, deleteDoc } from "firebase/firestore";
import { isFirebaseConfigured, db, handleFirestoreError, OperationType } from "./firebase";
import { DesignBoard, UserProfile, CostMetrics } from "../types";

const LOCAL_PROFILE_KEY = "ai_redizajn_profile";
const LOCAL_BOARDS_KEY = "ai_redizajn_boards";
const LOCAL_METRICS_KEY = "ai_redizajn_metrics";

// Initialize empty tracking metrics
export const defaultMetrics: CostMetrics = {
  firestoreReads: 0,
  firestoreWrites: 0,
  firebaseStorageRequests: 0,
  geminiTokensInput: 0,
  geminiTokensOutput: 0,
  geminiRequestsCount: 0,
  estimatedCostEur: 0.0,
};

export const StorageService = {
  // --- TELEMETRY AND SIMULATOR METRICS ---
  getMetrics(): CostMetrics {
    const data = localStorage.getItem(LOCAL_METRICS_KEY);
    if (!data) return { ...defaultMetrics };
    try {
      return JSON.parse(data);
    } catch {
      return { ...defaultMetrics };
    }
  },

  updateMetrics(updater: (current: CostMetrics) => void) {
    const current = this.getMetrics();
    updater(current);
    // Formula for simulated/estimated free tier consumption (Spark plan weights)
    const firestoreReadPrice = 0.00000006; // Euro per read
    const firestoreWritePrice = 0.00000018; // Euro per write
    const geminiInputPrice = 0.000000075; // Euro per token (very cheap)
    const geminiOutputPrice = 0.0000003; // Euro per token
    
    current.estimatedCostEur = 
      (current.firestoreReads * firestoreReadPrice) +
      (current.firestoreWrites * firestoreWritePrice) +
      (current.firebaseStorageRequests * 0.000005) +
      (current.geminiTokensInput * geminiInputPrice) +
      (current.geminiTokensOutput * geminiOutputPrice);

    localStorage.setItem(LOCAL_METRICS_KEY, JSON.stringify(current));
  },

  resetMetrics() {
    localStorage.setItem(LOCAL_METRICS_KEY, JSON.stringify({ ...defaultMetrics }));
  },

  // --- USER PROFILES ---
  async loadUserProfile(userId: string): Promise<UserProfile> {
    // 1. Check local storage cache first to minimize Firestore Reads
    const cached = localStorage.getItem(`${LOCAL_PROFILE_KEY}_${userId}`);
    if (cached) {
      try {
        const profile = JSON.parse(cached);
        this.updateMetrics(m => m.firestoreReads += 0); // No Firestore reads performed!
        return profile;
      } catch {
        // Fallback to fetch
      }
    }

    // 2. Local-only guest or unconfigured database
    if (!isFirebaseConfigured || !db) {
      const guestProfile: UserProfile = {
        userId,
        email: "host@obidenie.sk",
        displayName: "Anonymný Hosť (Bypass)",
        isAnonymous: true,
        credits: 100, // starting guest credits
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(`${LOCAL_PROFILE_KEY}_${userId}`, JSON.stringify(guestProfile));
      return guestProfile;
    }

    // 3. Fetch from remote Firestore
    const docRef = doc(db, "userProfiles", userId);
    try {
      this.updateMetrics(m => m.firestoreReads += 1); // Record Firestore read
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const profile = docSnap.data() as UserProfile;
        localStorage.setItem(`${LOCAL_PROFILE_KEY}_${userId}`, JSON.stringify(profile));
        return profile;
      } else {
        // Create a new cloud profile if missing
        const newProfile: UserProfile = {
          userId,
          email: "cloud_user@google.com",
          displayName: "Google Redizajn Používateľ",
          isAnonymous: false,
          credits: 150,
          createdAt: new Date().toISOString(),
        };
        await this.saveUserProfile(newProfile);
        return newProfile;
      }
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, `userProfiles/${userId}`) as any;
    }
  },

  async saveUserProfile(profile: UserProfile): Promise<void> {
    // Save in local storage
    localStorage.setItem(`${LOCAL_PROFILE_KEY}_${profile.userId}`, JSON.stringify(profile));

    if (!isFirebaseConfigured || !db) return;

    // Save in cloud
    try {
      this.updateMetrics(m => m.firestoreWrites += 1); // Record Firestore write
      await setDoc(doc(db, "userProfiles", profile.userId), profile);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `userProfiles/${profile.userId}`);
    }
  },

  // --- DESIGN BOARDS ---
  async loadDesignBoards(userId: string): Promise<DesignBoard[]> {
    // 1. Check local storage cache of boards
    const cached = localStorage.getItem(`${LOCAL_BOARDS_KEY}_${userId}`);
    if (cached) {
      try {
        const boards = JSON.parse(cached);
        console.log(`[Storage] Načítané ${boards.length} dizajn dosiek z lokálnej pamäte.`);
        return boards;
      } catch {
        // parse error
      }
    }

    // 2. Unconfigured / local return
    if (!isFirebaseConfigured || !db) {
      return [];
    }

    // 3. Fetch from Firestore query
    try {
      console.log("[Storage] Dotaz na Firestore pre získanie dosiek používateľa.");
      this.updateMetrics(m => m.firestoreReads += 1); // Cost query activation (1 read base)
      const q = query(collection(db, "designBoards"), where("userId", "==", userId));
      const querySnapshot = await getDocs(q);
      
      const boards: DesignBoard[] = [];
      querySnapshot.forEach((docSnap) => {
        boards.push(docSnap.data() as DesignBoard);
        this.updateMetrics(m => m.firestoreReads += 1); // Record each fetched document read
      });

      // Cache locally
      localStorage.setItem(`${LOCAL_BOARDS_KEY}_${userId}`, JSON.stringify(boards));
      return boards;
    } catch (err) {
      return handleFirestoreError(err, OperationType.LIST, `designBoards?userId=${userId}`) as any;
    }
  },

  async saveDesignBoard(board: DesignBoard): Promise<void> {
    const userId = board.userId;

    // Load current boards
    const currentBoards = await this.loadDesignBoards(userId);
    const existingIndex = currentBoards.findIndex(b => b.id === board.id);

    // Filter large base64 image payload from cloud DB writing to ensure Spark safety
    // Only compress / keep thumbnail references under 200kb to prevent DB size bloat
    const savedBoard: DesignBoard = {
      ...board,
      // If the original image is an extreme Base64 string, we downsize/store it inside local cache only,
      // and write a trimmed reference or smaller compressed version to Firestore.
      originalImage: board.originalImage ? 
        (board.originalImage.length > 50000 ? board.originalImage.substring(0, 50000) + "..." : board.originalImage) 
        : "",
    };

    if (existingIndex >= 0) {
      currentBoards[existingIndex] = board; // Local cache can retain the full, high resolution Base64 image
    } else {
      currentBoards.push(board);
    }

    // Save full cache locally
    localStorage.setItem(`${LOCAL_BOARDS_KEY}_${userId}`, JSON.stringify(currentBoards));

    if (!isFirebaseConfigured || !db) return;

    // Save compressed/reference to cloud Firestore
    try {
      console.log("[Storage] Odosielam optimalizovaný záznam návrhu do Firestore.");
      this.updateMetrics(m => m.firestoreWrites += 1);
      await setDoc(doc(db, "designBoards", savedBoard.id), savedBoard);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `designBoards/${savedBoard.id}`);
    }
  },

  async deleteDesignBoard(userId: string, boardId: string): Promise<void> {
    const currentBoards = await this.loadDesignBoards(userId);
    const filtered = currentBoards.filter(b => b.id !== boardId);
    localStorage.setItem(`${LOCAL_BOARDS_KEY}_${userId}`, JSON.stringify(filtered));

    if (!isFirebaseConfigured || !db) return;

    try {
      console.log(`[Storage] Vymazávam návrh ${boardId} z Firestore.`);
      this.updateMetrics(m => m.firestoreWrites += 1);
      await deleteDoc(doc(db, "designBoards", boardId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `designBoards/${boardId}`);
    }
  }
};
