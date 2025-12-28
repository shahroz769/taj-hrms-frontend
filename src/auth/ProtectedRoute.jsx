import { Navigate, Outlet } from "react-router";
import { useSelector } from "react-redux";
import { Loader2 } from "lucide-react";

const ProtectedRoute = ({ allowedRoles }) => {
  const isLogin = useSelector((state) => state.auth.isLogin);
  const isAuthChecking = useSelector((state) => state.auth.isAuthChecking);
  const role = useSelector((state) => state.auth.user?.role);

  if (isAuthChecking) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100vw", height: "100vh" }}>
        <Loader2 className="h-15 w-15 animate-spin" style={{ color: "#02542D" }} />
      </div>
    );
  }

  if (!isLogin) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
