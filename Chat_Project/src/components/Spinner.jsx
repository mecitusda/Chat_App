import React from "react";

export default function Spinner({ size = 40, color = "#00aaff" }) {
  return (
    <div
      className="spinner"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderTopColor: color,
      }}
    />
  );
}
