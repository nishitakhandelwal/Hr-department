import axios from "axios";

const API = "/api/users";

// Get users with filters
export const fetchUsers = async (filters = {}) => {
  const res = await axios.get(API, { params: filters });
  return res.data;
};