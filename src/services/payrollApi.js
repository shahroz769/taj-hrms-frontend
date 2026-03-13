import API from "./api";

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

export const generatePayrolls = async ({ year, month, forceReplace = false }) => {
  const response = await API.post("/api/payrolls/generate", {
    year,
    month,
    forceReplace,
  });

  return response.data;
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
