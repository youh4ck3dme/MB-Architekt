/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { ShieldAlert, RefreshCw, Layers } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Zachytená neočakávaná chyba v Error Boundary:", error, errorInfo);
  }

  private handleReset = () => {
    // Clear potentially corrupted local keys and reload
    localStorage.removeItem("ai_redizajn_profile");
    // Reload the frame
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let isPermissionDenied = false;
      let parsedErrorInfo: any = null;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed && typeof parsed === "object" && "authInfo" in parsed) {
            parsedErrorInfo = parsed;
            if (parsed.error && parsed.error.toLowerCase().includes("permission")) {
              isPermissionDenied = true;
            }
          }
        }
      } catch {
        // Not a JSON error, proceed with plain text check
        if (this.state.error?.message?.toLowerCase().includes("permission") || 
            this.state.error?.message?.toLowerCase().includes("insufficient")) {
          isPermissionDenied = true;
        }
      }

      return (
        <div id="error-boundary-screen" className="min-h-screen bg-[#FAF9F6] swiss-grid flex flex-col items-center justify-center p-6 text-gray-900 font-sans selection:bg-[#1C1C1C] selection:text-white">
          <div className="w-full max-w-xl bg-white border border-[#1C1C1C]/10 rounded-none shadow-sm p-8 md:p-12">
            
            {/* Header / Brand label */}
            <div className="flex items-center space-x-2 text-xs font-mono tracking-wider text-gray-400 uppercase mb-8 pb-4 border-b border-[#1C1C1C]/10">
              <Layers className="w-4 h-4 text-gray-500" />
              <span>Systémová Telemetria - Error Boundary</span>
            </div>

            {/* Error Graphic Icon */}
            <div className="flex items-center justify-center w-12 h-12 bg-[#1C1C1C]/5 mb-6 rounded-none">
              <ShieldAlert className="w-6 h-6 text-[#1C1C1C]" />
            </div>

            {/* Error messaging */}
            <h1 className="font-display text-2xl font-semibold tracking-tight text-gray-900 mb-4">
              Zachytená bezpečnostná alebo systémová výnimka
            </h1>

            {isPermissionDenied ? (
              <div className="space-y-4 text-sm text-gray-600">
                <p>
                  Načítanie alebo zápis dát do <strong>Cloud Firestore</strong> bol odmietnutý z dôvodu nedostatočných oprávnení v súbore <code className="bg-[#1C1C1C]/5 px-1.5 py-0.5 rounded text-xs font-mono text-gray-800">firestore.rules</code>.
                </p>
                <p className="font-medium text-gray-800">Návod na nápravu pre administrátora:</p>
                <ol className="list-decimal pl-5 space-y-2 text-xs">
                  <li>Skontrolujte, či ste úspešne nasadili najnovší súbor pravidiel pomocou nástroja <strong>deploy_firebase</strong>.</li>
                  <li>Overte typ autentifikovaného používateľa (Aktuálny stav: <strong className="font-sans text-gray-900">{parsedErrorInfo?.authInfo?.userId ? "Prihlásený UID: " + parsedErrorInfo.authInfo.userId : "Neprihlásený / Hosť"}</strong>).</li>
                  <li>Nepokúšajte sa ukladať masívne Base64 obrázky; uistite sa, ze dáta do databázy sú predtým komprimované na našom odľahčenom klientovi.</li>
                </ol>
              </div>
            ) : (
              <div className="space-y-4 text-sm text-gray-600">
                <p>
                  Došlo k neočakávanej chybe pri spracovaní používateľského rozhrania alebo komunikácie so serverom.
                </p>
                <div className="bg-[#1C1C1C]/5 p-4 rounded-none border border-[#1C1C1C]/10 mb-4 max-h-32 overflow-y-auto">
                  <p className="text-xs font-mono text-gray-700 break-all">
                    {this.state.error?.toString() || "Neznáma systémová chyba."}
                  </p>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-8 pt-6 border-t border-[#1C1C1C]/10 flex flex-col sm:flex-row gap-4">
              <button
                id="error-reset-button"
                onClick={this.handleReset}
                className="flex items-center justify-center space-x-2 bg-[#1C1C1C] text-white hover:bg-[#1C1C1C]/90 focus:outline-none transition-all px-5 py-3 text-xs font-mono tracking-wider uppercase cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin-reverse" />
                <span>Reštartovať Aplikáciu</span>
              </button>
              
              <button
                id="error-ignore-button"
                onClick={() => (this as any).setState({ hasError: false, error: null })}
                className="flex items-center justify-center border border-[#1C1C1C]/10 hover:bg-black/5 transition-all px-5 py-3 text-xs font-mono tracking-wider uppercase text-gray-600"
              >
                Ignorovať a pokračovať
              </button>
            </div>

          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
export default ErrorBoundary;
