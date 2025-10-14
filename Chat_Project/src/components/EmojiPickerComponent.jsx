"use client";

import * as React from "react";

export function EmojiPicker({ onSelect, className }) {
  return (
    <div className={`rounded-lg border shadow-md p-2 ${className || ""}`}></div>
  );
}
