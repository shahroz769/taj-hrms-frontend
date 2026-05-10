import API from "./api";

export const fetchEmployees = async ({
  page = 1,
  limit = 10,
  search = "",
  department = "",
  position = "",
  status = "",
  type = "",
  shift = "",
}) => {
  const res = await API.get(`/api/employees`, {
    params: {
      page,
      limit,
      search,
      department,
      position,
      status,
      type,
      shift,
    },
  });
  return res.data;
};

export const fetchEmployeeById = async (id) => {
  const res = await API.get(`/api/employees/${id}`);
  return res.data;
};

export const createEmployee = async (formData) => {
  const res = await API.post(`/api/employees`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
};

export const updateEmployee = async (id, formData) => {
  const res = await API.put(`/api/employees/${id}`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
};

export const fetchEmployeesList = async ({ q = "", limit = 10 } = {}) => {
  const res = await API.get(`/api/employees/list`, {
    params: { q, limit },
  });
  return res.data;
};

export const fetchNextEmployeeId = async () => {
  const res = await API.get(`/api/employees/next-id`);
  return res.data;
};

export const fetchPositionsByDepartment = async (departmentId) => {
  const res = await API.get(`/api/positions/by-department/${departmentId}`);
  return res.data;
};

export const fetchEmployeeCompensationHistory = async (id) => {
  const res = await API.get(`/api/employees/${id}/compensation-history`);
  return res.data;
};

export const fetchEmployeePositionHistory = async (id) => {
  const res = await API.get(`/api/employees/${id}/position-history`);
  return res.data;
};

export const fetchEmployeeLeaveBalances = async (id, year) => {
  const res = await API.get(`/api/employees/${id}/leave-balances`, {
    params: year ? { year } : {},
  });
  return res.data;
};

export const fetchEmployeePayrolls = async (
  id,
  { page = 1, limit = 10, year = "", month = "" } = {},
) => {
  const res = await API.get(`/api/employees/${id}/payrolls`, {
    params: { page, limit, year, month },
  });
  return res.data;
};

export const fetchEmployeeLeaveApplicationsList = async (
  id,
  { page = 1, limit = 10, status = "" } = {},
) => {
  const res = await API.get(`/api/employees/${id}/leave-applications`, {
    params: { page, limit, status },
  });
  return res.data;
};

export const endEmployeeEmployment = async (id, payload) => {
  const res = await API.post(`/api/employees/${id}/end-employment`, payload);
  return res.data;
};

export const rejoinEmployee = async (id, payload) => {
  const res = await API.post(`/api/employees/${id}/rejoin`, payload);
  return res.data;
};

export const transferEmployeePosition = async (id, payload) => {
  const res = await API.patch(`/api/employees/${id}/position`, payload);
  return res.data;
};
