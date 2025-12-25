import { Navigate, Outlet } from "react-router";
import { useSelector } from "react-redux";
import { BounceLoader } from "react-spinners";

const ProtectedRoute = ({ allowedRoles }) => {
  const isLogin = useSelector((state) => state.auth.isLogin);
  const isAuthChecking = useSelector((state) => state.auth.isAuthChecking);
  const role = useSelector((state) => state.auth.user?.role);

  if (isAuthChecking) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100vw", height: "100vh" }}>
        <BounceLoader color="#36d7b7" size={60} />
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
