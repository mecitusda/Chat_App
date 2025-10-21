// components/AppLoader.jsx
import React, { useEffect, useState } from "react";

export default function AppLoader({ progress = 0 }) {
  return (
    <div className="app-loader">
      <div className="app-loader__inner">
        <div className="app-loader__logo">
          <img src="/images/inner_logo.png" alt="Scriber Logo" />
          {/* <h1 className="app-loader__title">Scriber</h1> */}
        </div>

        <div className="app-loader__bar">
          <div
            className="app-loader__progress"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="app-loader__percent">{progress}%</p>
        <p className="app-loader__text">
          Veriler yükleniyor, lütfen bekleyin...
        </p>
      </div>
    </div>
  );
}
