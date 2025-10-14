import React, { useEffect, useRef } from "react";

export default function OTPInput({ value, onChange, length = 6 }) {
  const refs = useRef([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const asArray = () =>
    Array.from({ length }, (_, i) => (value && value[i]) || "");

  const handleChange = (e, i) => {
    const ch = e.target.value.replace(/\D/g, "").slice(-1); // tek rakam
    const arr = asArray();
    arr[i] = ch || "";
    onChange(arr.join(""));

    if (ch && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (e, i) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const arr = asArray();
      if (arr[i]) {
        arr[i] = "";
        onChange(arr.join(""));
      } else if (i > 0) {
        arr[i - 1] = "";
        onChange(arr.join(""));
        refs.current[i - 1]?.focus();
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "");
    const arr = asArray();
    for (let i = 0; i < length; i++) arr[i] = digits[i] || "";
    onChange(arr.join(""));
    if (digits.length >= length) refs.current[length - 1]?.blur();
  };

  const baseStyle = {
    width: "44px",
    height: "48px",
    textAlign: "center",
    fontSize: "22px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    backgroundColor: "#fff",
    color: "#000",
    outline: "none",
  };

  return (
    <div
      style={{ display: "flex", gap: 8, justifyContent: "center" }}
      onPaste={handlePaste}
    >
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={asArray()[i]}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          style={baseStyle}
        />
      ))}
    </div>
  );
}
