
"use client";

import React, { useRef, useEffect } from "react";
import Keyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";
import { usePOS } from "../context/POSContext";
import { X, Keyboard as KeyboardIcon, Move } from "lucide-react";
import { Button } from "@/components/ui/button";

export const VirtualKeyboard: React.FC = () => {
  const { 
    vKeyboardEnabled, 
    vKeyboardActiveInput, 
    setVKeyboardActiveInput 
  } = usePOS();
  
  const keyboard = useRef<any>(null);

  // Sync internal keyboard state when active input changes
  useEffect(() => {
    if (vKeyboardActiveInput && keyboard.current) {
      keyboard.current.setInput(vKeyboardActiveInput.value);
    }
  }, [vKeyboardActiveInput?.key]);

  if (!vKeyboardEnabled || !vKeyboardActiveInput) return null;

  const onChange = (input: string) => {
    if (vKeyboardActiveInput) {
      vKeyboardActiveInput.setter(input);
      // Also update the context's current value to keep it all in sync
      setVKeyboardActiveInput({ ...vKeyboardActiveInput, value: input });
    }
  };

  const onKeyPress = (button: string) => {
    if (button === "{shift}" || button === "{lock}") handleShift();
    if (button === "{enter}" || button === "{escape}") {
        setVKeyboardActiveInput(null);
    }
  };

  const handleShift = () => {
    const currentLayout = keyboard.current.options.layoutName;
    const shiftToggle = currentLayout === "default" ? "shift" : "default";
    keyboard.current.setOptions({
      layoutName: shiftToggle
    });
  };

  const layout = {
      default: [
        "q w e r t y u i o p",
        "a s d f g h j k l",
        "{shift} z x c v b n m {backspace}",
        "{numbers} {space} {enter}"
      ],
      shift: [
        "Q W E R T Y U I O P",
        "A S D F G H J K L",
        "{shift} Z X C V B N M {backspace}",
        "{numbers} {space} {enter}"
      ],
      numbers: [
        "1 2 3",
        "4 5 6",
        "7 8 9",
        "{abc} 0 {backspace}",
        "{enter}"
      ]
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-slate-100/80 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-[0_-20px_50px_rgba(0,0,0,0.2)] animate-in slide-in-from-bottom duration-300 p-2 sm:p-4 rounded-t-[2.5rem]">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4 px-4 pt-2">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                    <KeyboardIcon className="w-4 h-4 text-primary" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Virtual Input</p>
                    <p className="text-sm font-black text-foreground">
                        {vKeyboardActiveInput.key}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full hover:bg-rose-100 hover:text-rose-600 transition-colors"
                    onClick={() => setVKeyboardActiveInput(null)}
                 >
                    <X className="w-5 h-5" />
                 </Button>
            </div>
        </div>

        <div className="modern-keyboard-container">
            <Keyboard
                keyboardRef={r => (keyboard.current = r)}
                layoutName={vKeyboardActiveInput.type === 'numeric' ? 'numbers' : 'default'}
                layout={layout}
                onChange={onChange}
                onKeyPress={onKeyPress}
                theme={"hg-theme-default hg-layout-default modern-pos-keyboard"}
                display={{
                    "{backspace}": "⌫",
                    "{enter}": "DONE",
                    "{shift}": "⬆",
                    "{space}": "SPACE",
                    "{numbers}": "123",
                    "{abc}": "ABC",
                }}
                buttonTheme={[
                    {
                        class: "special-key",
                        buttons: "{shift} {backspace} {enter} {space} {numbers} {abc}"
                    }
                ]}
            />
        </div>

        <style jsx global>{`
            .modern-pos-keyboard {
                background: transparent !important;
                font-family: inherit !important;
            }
            .hg-button {
                height: 55px !important;
                background: white !important;
                border: none !important;
                border-radius: 12px !important;
                box-shadow: 0 4px 0 rgba(0,0,0,0.05) !important;
                font-weight: 800 !important;
                font-size: 1.1rem !important;
                color: #1e293b !important;
                transition: all 0.1s ease !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
            }
            .dark .hg-button {
                background: #1e293b !important;
                color: #f8fafc !important;
                box-shadow: 0 4px 0 rgba(0,0,0,0.2) !important;
            }
            .hg-button:active {
                transform: translateY(2px) !important;
                box-shadow: 0 2px 0 rgba(0,0,0,0.05) !important;
            }
            .special-key {
                background: #f1f5f9 !important;
                color: #64748b !important;
            }
            .dark .special-key {
                background: #334155 !important;
                color: #94a3b8 !important;
            }
            .hg-button[data-skbtn="{enter}"] {
                background: #0ea5e9 !important;
                color: white !important;
                flex-grow: 2 !important;
            }
            .hg-button[data-skbtn="{space}"] {
                flex-grow: 5 !important;
            }
        `}</style>
      </div>
    </div>
  );
};
