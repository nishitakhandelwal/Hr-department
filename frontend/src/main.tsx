import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const storedTheme = window.localStorage.getItem("hr_theme");
const initialTheme =
  storedTheme === "dark" || storedTheme === "light"
    ? storedTheme
    : "light";
document.documentElement.classList.toggle("dark", initialTheme === "dark");
document.documentElement.style.colorScheme = initialTheme;

createRoot(document.getElementById("root")!).render(<App />);
