import React, { useState } from "react";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

export default function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);

  return (
    <div style={styles.wrapper}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={styles.input}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        style={styles.iconBtn}
      >
        {show ? (
          <VisibilityOff style={styles.icon} />
        ) : (
          <Visibility style={styles.icon} />
        )}
      </button>
    </div>
  );
}

const styles = {
  wrapper: {
    position: "relative",
    width: "100%",
    display: "flex",
    alignItems: "center",
    backgroundColor: "#1c1c1c",
    borderRadius: "10px",
    border: "1.5px solid #fff",
    marginBottom: "16px",
  },
  input: {
    width: "100%",
    background: "transparent",
    border: "none",
    outline: "none",
    padding: "12px 45px 12px 14px",
    color: "#fff",
    fontSize: "1.4rem",
  },
  iconBtn: {
    position: "absolute",
    right: "10px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: "22px",
  },
};
