import API from "./api";

export const fetchShiftsList = async () => {
  const res = await API.get(`/api/employee-shifts/shifts-list`);
  return res.data.shifts;
};

export const assignShiftToEmployees = async (payload) => {
  const res = await API.post(`/api/employee-shifts/assign`, payload);
  return res.data;
};
