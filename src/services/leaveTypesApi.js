import API from "./api";

export const fetchLeaveTypes = async ({ page = 1, limit = 10, search = "" }) => {
  const res = await API.get(`/api/leave-types`, {
    params: { page, limit, search },
  });
  return res.data;
};

export const createLeaveType = async (payload) => {
  const res = await API.post(`/api/leave-types`, payload);
  return res.data;
};

export const updateLeaveType = async (id, payload) => {
  const res = await API.put(`/api/leave-types/${id}`, payload);
  return res.data;
};

export const deleteLeaveType = async (id) => {
  const res = await API.delete(`/api/leave-types/${id}`);
  return res.data;
};

export const updateLeaveTypeStatus = async (id, status) => {
  const res = await API.patch(`/api/leave-types/${id}/status`, { status });
  return res.data;
}