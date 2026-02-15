import API from "./api";

export const fetchWarningTypes = async ({
  page = 1,
  limit = 10,
  search = "",
}) => {
  const res = await API.get(`/api/warning-types`, {
    params: { page, limit, search },
  });
  return res.data;
};

export const fetchWarningTypesList = async () => {
  const res = await API.get(`/api/warning-types/list`);
  return res.data;
};

export const createWarningType = async (payload) => {
  const res = await API.post(`/api/warning-types`, payload);
  return res.data;
};

export const updateWarningType = async (id, payload) => {
  const res = await API.put(`/api/warning-types/${id}`, payload);
  return res.data;
};

export const deleteWarningType = async (id) => {
  const res = await API.delete(`/api/warning-types/${id}`);
  return res.data;
};

export const updateWarningTypeStatus = async (id, status) => {
  const res = await API.patch(`/api/warning-types/${id}/status`, { status });
  return res.data;
};
