import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const storedTheme = window.localStorage.getItem("hr_theme");
const initialTheme = storedTheme === "light" ? "light" : "dark";
window.localStorage.setItem("hr_theme", initialTheme);
document.documentElement.classList.toggle("dark", initialTheme === "dark");
document.documentElement.setAttribute("data-theme", initialTheme);
document.documentElement.style.colorScheme = initialTheme;

createRoot(document.getElementById("root")!).render(<App />);
