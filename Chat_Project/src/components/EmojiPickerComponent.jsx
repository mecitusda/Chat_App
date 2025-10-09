"use client";

import * as React from "react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

export function EmojiPicker({ onSelect, className }) {
  return (
    <div className={`rounded-lg border shadow-md p-2 ${className || ""}`}>
      <Picker
        data={data}
        onEmojiSelect={(e) => onSelect?.(e.native)}
        theme="dark"
        previewPosition="none"
      />
    </div>
  );
}
