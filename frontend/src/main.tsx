import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import "./App.css";
import Selector from "./routes/Selector";
import BoardDetail from "./routes/BoardDetail";
import Layout from "./routes/Layout";
import AdminLayout from "./admin/AdminLayout";
import AdminBoard from "./admin/AdminBoard";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Selector /> },
      { path: "board/:slug", element: <BoardDetail /> },
      {
        path: "admin",
        element: <AdminLayout />,
        children: [
          { path: ":slug", element: <AdminBoard /> },
        ],
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
