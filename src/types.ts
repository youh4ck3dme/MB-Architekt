/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FurnitureLayoutItem {
  name: string;
  category: string;
  coordinateX: number; // 0 to 100
  coordinateY: number; // 0 to 100
  width: number; // cm
  depth: number; // cm
  estimatedPrice: number; // EUR
  storeRecommendation: string;
  description: string;
}

export interface RoomAnalysisResult {
  roomType: string;
  aestheticStyle: string;
  summary: string; // Slovak spatial and aesthetic critique
  colorPalette: string[]; // List of HEX colors (e.g., ["#F4F1EA", ...])
  materials: string[]; // List of Slovak materials
  lightingTips: string; // Slovak lighting recommendations
  furnitureLayout: FurnitureLayoutItem[];
}

export interface DesignBoard {
  id: string;
  userId: string;
  roomType: string;
  style: string;
  budget: number;
  originalImage: string; // Pre-compressed base64 or thumbnail placeholder
  redesignedImage: string; // Render layout path or reference
  colorPalette: string; // comma-separated HEX codes
  analysisText: string; // Slovak critique
  shoppingList: string; // JSON string of FurnitureLayoutItem[]
  createdAt: string; // date-time string
}

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  isAnonymous: boolean;
  credits: number;
  createdAt: string;
}

// Spark Plan visual metrics simulator
export interface CostMetrics {
  firestoreReads: number;
  firestoreWrites: number;
  firebaseStorageRequests: number;
  geminiTokensInput: number;
  geminiTokensOutput: number;
  geminiRequestsCount: number;
  estimatedCostEur: number;
}
