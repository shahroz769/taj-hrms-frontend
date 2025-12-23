import "./App.css";
import { BrowserRouter, Route, Routes } from "react-router";

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<h1>Hello Vite + React!</h1>} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
export default App;
