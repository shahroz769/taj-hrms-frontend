import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDispatch } from "react-redux";
import { login } from "@/redux/slices/authSlice";
import { useNavigate } from "react-router";
import { loginUser } from "@/services/authApi";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/taj-logo.png";

const formSchema = z.object({
  username: z
    .string()
    .min(1, {
      message: "Username is required.",
    })
    .min(2, {
      message: "Username must be at least 2 characters.",
    }),
  password: z
    .string()
    .min(1, {
      message: "Password is required.",
    })
    .min(6, {
      message: "Password must be at least 6 characters.",
    }),
});

const LoginForm = ({ className, ...props }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data) => {
    try {
      const response = await loginUser(data);
      dispatch(login(response.data));
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Login error:", error);
      const errorMessage =
        error.response?.data?.message || "Login failed. Please try again.";
      toast.error(errorMessage);
    }
  };

  return (
    <div className={cn("flex flex-col gap-4", className)} {...props}>
      <Card>
        <CardHeader>
          <div className="flex justify-center mb-4">
            <img src={logo} alt="Logo" />
          </div>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your username below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="username">Username</FieldLabel>
                <Input
                  id="username"
                  type="text"
                  {...register("username")}
                  className={errors.username}
                />
                {errors.username && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.username.message}
                  </p>
                )}
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    {...register("password")}
                    className={errors.password}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.password.message}
                  </p>
                )}
              </Field>
              <Field>
                <Button type="submit" variant="green" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Logging in
                    </>
                  ) : (
                    "Login"
                  )}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginForm;
