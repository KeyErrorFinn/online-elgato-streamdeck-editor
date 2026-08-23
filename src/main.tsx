import { createRoot } from "react-dom/client";

import ProfileTester from "./components/ProfileTester";

import "./main.css";
import "./editorChrome.css";

const App = () => {
    return <ProfileTester />;
};

createRoot(document.getElementById("root")!).render(
    // <StrictMode>
    <App />,
    // </StrictMode>
);
