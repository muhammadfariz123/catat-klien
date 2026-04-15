import React from "react";
import { Routes, Route } from "react-router-dom";

import Landing from "./pages/Landing";
import UserBookingForm from "./pages/UserBookingForm";
import Dashboard from "./pages/Dashboard";
import Financial from "./pages/Financial";
import ProtectedRoute from "./routes/ProtectedRoute";
import ServiceTypes from "./pages/ServiceType";

function App() {
  return (
    <Routes>
      {/* LANDING */}
      <Route path="/" element={<Landing />} />

      {/* USER BOOKING FORM FROM SHARED LINK */}
      <Route path="/booking/:ownerId" element={<UserBookingForm />} />

      {/* ADMIN LOGIN PAGE */}
      <Route path="/admin" element={<Landing />} />

      {/* SERVICE TYPES */}
      <Route path="/service-types" element={<ServiceTypes />} />

      {/* DASHBOARD */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* FINANCIAL */}
      <Route
        path="/financial"
        element={
          <ProtectedRoute>
            <Financial />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;