"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquarePlus, Plus, X } from "lucide-react";

const PRESET_KEY = "pos_modifier_presets";
const DEFAULT_PRESETS = [
  "Less spicy", "Extra spicy", "No onion", "No garlic", "Extra cheese",
  "No ice", "Less sugar", "No sugar", "Well done", "Pack separately",
];

function loadPresets(): string[] {
  try {
    const raw = window.localStorage.getItem(PRESET_KEY);
    const list = raw ? JSON.parse(raw) : null;
    if (Array.isArray(list) && list.every((x) => typeof x === "string")) return list;
  } catch {}
  return DEFAULT_PRESETS;
}

function savePresets(list: string[]) {
  try { window.localStorage.setItem(PRESET_KEY, JSON.stringify(list)); } catch {}
}

interface LineNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  notes?: string;
  modifiers?: string[];
  onSave: (notes: string, modifiers: string[]) => void;
}

/**
 * Kitchen instructions for one cart line: quick-pick modifiers
 * (presets saved on this terminal) plus a free-text note.
 * Both print on the KOT and the guest bill.
 */
export const LineNoteDialog: React.FC<LineNoteDialogProps> = ({ open, onOpenChange, itemName, notes, modifiers, onSave }) => {
  const [presets, setPresets] = useState<string[]>(DEFAULT_PRESETS);
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [newPreset, setNewPreset] = useState("");

  useEffect(() => {
    if (!open) return;
    setPresets(loadPresets());
    setSelected(modifiers || []);
    setText(notes || "");
    setNewPreset("");
  }, [open, notes, modifiers]);

  const toggle = (m: string) =>
    setSelected((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const addPreset = () => {
    const v = newPreset.trim();
    if (!v) return;
    if (!presets.includes(v)) {
      const next = [...presets, v];
      setPresets(next);
      savePresets(next);
    }
    if (!selected.includes(v)) setSelected((prev) => [...prev, v]);
    setNewPreset("");
  };

  const removePreset = (m: string) => {
    const next = presets.filter((x) => x !== m);
    setPresets(next);
    savePresets(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="p-0 gap-0 flex flex-col overflow-hidden">
        {/* Header: title + item on its own line, so long names never widen the dialog */}
        <DialogHeader className="px-5 pt-5 pb-3 pr-12 text-left border-b border-border min-w-0">
          <DialogTitle>Kitchen note</DialogTitle>
          <p className="text-sm text-muted-foreground line-clamp-2 break-words">{itemName}</p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5 py-4 space-y-4">
          <div>
            <div className="text-sm font-medium mb-2">Quick modifiers</div>
            <div className="flex flex-wrap gap-2">
              {presets.map((m) => {
                const on = selected.includes(m);
                return (
                  <span key={m} className="group relative">
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(m)}
                      className={`h-9 px-3 rounded-md text-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        on ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"
                      }`}
                    >
                      {m}
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove "${m}" from presets`}
                      onClick={() => removePreset(m)}
                      className="absolute -top-1.5 -right-1.5 hidden group-hover:flex w-5 h-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
            <div className="flex gap-2 mt-3">
              <Input
                value={newPreset}
                onChange={(e) => setNewPreset(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPreset(); } }}
                placeholder="New modifier (saved on this terminal)"
                aria-label="New modifier"
                className="h-9 min-w-0"
              />
              <Button type="button" variant="outline" className="h-9 shrink-0" onClick={addPreset} disabled={!newPreset.trim()}>
                <Plus className="w-4 h-4 mr-1" aria-hidden="true" /> Add
              </Button>
            </div>
          </div>

          <div>
            <label htmlFor="line-note-text" className="text-sm font-medium">Note</label>
            <Textarea
              id="line-note-text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 500))}
              placeholder="e.g. Serve after starters"
              rows={2}
              className="mt-1.5 resize-none"
            />
            <div className="mt-1 text-right text-xs text-muted-foreground">{text.length}/500</div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end gap-2 shrink-0">
          <Button
            variant="outline"
            className="h-10"
            onClick={() => { onSave("", []); onOpenChange(false); }}
          >
            Clear note
          </Button>
          <Button
            className="h-10 px-5"
            onClick={() => { onSave(text.trim(), selected); onOpenChange(false); }}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
