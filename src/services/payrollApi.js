import API from "./api";
import { store } from "@/redux/store";

export const fetchPayrolls = async ({
  page = 1,
  limit = 10,
  search = "",
  year = "",
  month = "",
  department = "",
  position = "",
}) => {
  const response = await API.get("/api/payrolls", {
    params: {
      page,
      limit,
      search,
      year,
      month,
      department,
      position,
    },
  });

  return response.data;
};

export const previewPayrollGeneration = async ({ year, month }) => {
  const response = await API.get("/api/payrolls/preview", {
    params: { year, month },
  });

  return response.data;
};

export const generatePayrolls = async ({ year, month, forceReplace = false, onProgress }) => {
  const token = store.getState().auth.accessToken;

  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/payrolls/generate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ year, month, forceReplace }),
    },
  );

  if (!response.ok) {
    let message = "Payroll generation failed";
    try {
      const data = await response.json();
      message = data.message || message;
    } catch (_) {
      // ignore parse error
    }
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop(); // keep incomplete last chunk

    for (const part of parts) {
      const dataLine = part.split("\n").find((l) => l.startsWith("data: "));
      if (!dataLine) continue;

      let event;
      try {
        event = JSON.parse(dataLine.slice(6));
      } catch (_) {
        continue;
      }

      if (typeof onProgress === "function") {
        onProgress(event);
      }

      if (event.type === "complete") {
        return event;
      }

      if (event.type === "error") {
        throw new Error(event.message || "Payroll generation failed");
      }
    }
  }

  throw new Error("Stream ended without completion");
};

export const regenerateEmployeePayroll = async ({ employeeId, year, month }) => {
  const response = await API.post(`/api/payrolls/${employeeId}/regenerate`, {
    year,
    month,
  });

  return response.data;
};

export const fetchPayrollById = async (id) => {
  const response = await API.get(`/api/payrolls/${id}`);
  return response.data;
};

export const fetchPayslip = async (id) => {
  const response = await API.get(`/api/payrolls/${id}/payslip`);
  return response.data;
};

export const downloadPayslipPdf = async (id) => {
  const response = await API.get(`/api/payrolls/${id}/payslip/pdf`, {
    responseType: "blob",
  });

  return response.data;
};
