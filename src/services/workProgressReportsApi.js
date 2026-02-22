import API from "./api";

export const fetchWorkProgressReports = async ({
  page = 1,
  limit = 10,
  search = "",
}) => {
  const res = await API.get(`/api/work-progress-reports`, {
    params: { page, limit, search },
  });
  return res.data;
};

export const fetchEmployeeProgressReports = async ({
  page = 1,
  limit = 10,
  search = "",
  department = "",
  position = "",
  status = "",
  type = "",
  periodType = "yearly",
  year,
  quarter,
  month,
}) => {
  const res = await API.get(`/api/work-progress-reports/employee-progress`, {
    params: {
      page,
      limit,
      search,
      department,
      position,
      status,
      type,
      periodType,
      year,
      quarter,
      month,
    },
  });
  return res.data;
};

export const fetchWorkProgressReportById = async (id) => {
  const res = await API.get(`/api/work-progress-reports/${id}`);
  return res.data;
};

export const searchEmployeesForTask = async (query) => {
  const res = await API.get(`/api/work-progress-reports/search-employees`, {
    params: { q: query },
  });
  return res.data;
};

export const createWorkProgressReport = async (payload) => {
  const res = await API.post(`/api/work-progress-reports`, payload);
  return res.data;
};

export const updateWorkProgressReport = async (id, payload) => {
  const res = await API.put(`/api/work-progress-reports/${id}`, payload);
  return res.data;
};

export const startTaskApi = async (id) => {
  const res = await API.put(`/api/work-progress-reports/${id}/start`);
  return res.data;
};

export const completeTaskApi = async (id) => {
  const res = await API.put(`/api/work-progress-reports/${id}/complete`);
  return res.data;
};

export const addRemarksApi = async (id, payload) => {
  const res = await API.post(
    `/api/work-progress-reports/${id}/remarks`,
    payload,
  );
  return res.data;
};

export const closeTaskApi = async (id, payload) => {
  const res = await API.put(`/api/work-progress-reports/${id}/close`, payload);
  return res.data;
};

export const deleteWorkProgressReport = async (id) => {
  const res = await API.delete(`/api/work-progress-reports/${id}`);
  return res.data;
};
