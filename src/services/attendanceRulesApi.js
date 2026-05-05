import API from "./api";

export const fetchAttendanceRules = async () => {
  const res = await API.get(`/api/attendance-rules`);
  return res.data;
};

export const updateAttendanceRules = async (payload) => {
  const res = await API.put(`/api/attendance-rules`, payload);
  return res.data;
};
