import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

const Login = lazy(() => import("./pages/Login"));
const SignUp = lazy(() => import("./pages/SignUp"));
const Groups = lazy(() => import("./pages/Groups"));
const GroupDetail = lazy(() => import("./pages/GroupDetail"));

export default function App() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-[#F2F0EA]"><p className="text-gray-400 text-sm">Loading...</p></div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/groups" element={<Groups />} />
            <Route path="/groups/:id" element={<GroupDetail />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/groups" replace />} />
      </Routes>
    </Suspense>
  );
}
