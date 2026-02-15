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

export const fetchWorkProgressReportById = async (id) => {
  const res = await API.get(`/api/work-progress-reports/${id}`);
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

export const deleteWorkProgressReport = async (id) => {
  const res = await API.delete(`/api/work-progress-reports/${id}`);
  return res.data;
};
