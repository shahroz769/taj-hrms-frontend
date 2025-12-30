import { Navigate, Outlet } from "react-router";
import { useSelector } from "react-redux";
import { Spinner } from "@/components/ui/spinner";

const AuthLayout = () => {
  const isLogin = useSelector((state) => state.auth.isLogin);
  const isAuthChecking = useSelector((state) => state.auth.isAuthChecking);

  if (isAuthChecking) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100vw",
          height: "100vh",
        }}
      >
        <Spinner className="size-15 text-[#02542D]" />
      </div>
    );
  }

  if (isLogin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default AuthLayout;
