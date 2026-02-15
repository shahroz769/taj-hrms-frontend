import API from "./api";

export const fetchLeaveApplications = async ({
  page = 1,
  limit = 10,
  search = "",
}) => {
  const res = await API.get(`/api/leave-applications`, {
    params: { page, limit, search },
  });
  return res.data;
};

export const createLeaveApplication = async (payload) => {
  const res = await API.post(`/api/leave-applications`, payload);
  return res.data;
};

export const updateLeaveApplication = async (id, payload) => {
  const res = await API.put(`/api/leave-applications/${id}`, payload);
  return res.data;
};

export const approveLeaveApplication = async (id) => {
  const res = await API.patch(`/api/leave-applications/${id}/approve`);
  return res.data;
};

export const rejectLeaveApplication = async (id) => {
  const res = await API.patch(`/api/leave-applications/${id}/reject`);
  return res.data;
};

export const deleteLeaveApplication = async (id) => {
  const res = await API.delete(`/api/leave-applications/${id}`);
  return res.data;
};

export const fetchEmployeeLeaveBalance = async (employeeId) => {
  const res = await API.get(
    `/api/leave-applications/balance/${employeeId}`
  );
  return res.data;
};
